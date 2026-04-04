#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
LAB_DIR="${DORA_VM_LAB_DIR:-$ROOT_DIR/.cache/dora-vm-lab}"
URI="${DORA_VM_URI:-qemu:///system}"
NETWORK="${DORA_VM_NETWORK:-default}"
DEFAULT_USER="${DORA_VM_USER:-dora}"
DEFAULT_MEMORY_MB="${DORA_VM_MEMORY_MB:-6144}"
DEFAULT_VCPUS="${DORA_VM_VCPUS:-4}"
DEFAULT_DISK_GB="${DORA_VM_DISK_GB:-48}"
DEFAULT_WINDOWS_MEMORY_MB="${DORA_VM_WINDOWS_MEMORY_MB:-8192}"
DEFAULT_WINDOWS_VCPUS="${DORA_VM_WINDOWS_VCPUS:-4}"
DEFAULT_WINDOWS_DISK_GB="${DORA_VM_WINDOWS_DISK_GB:-96}"

UBUNTU_PROFILE="ubuntu-noble"
UBUNTU_URL="https://cloud-images.ubuntu.com/noble/current/noble-server-cloudimg-amd64.img"
ARCH_PROFILE="archlinux"
ARCH_URL="https://geo.mirror.pkgbuild.com/images/latest/Arch-Linux-x86_64-cloudimg.qcow2"

mkdir -p "$LAB_DIR"

blue() { printf '\033[36m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
yellow() { printf '\033[33m%s\033[0m\n' "$1"; }
red() { printf '\033[31m%s\033[0m\n' "$1"; }

die() {
	red "$1"
	exit 1
}

require_cmd() {
	command -v "$1" >/dev/null 2>&1 || die "Missing required command: $1"
}

run() {
	echo "+ $*"
	"$@"
}

sudo_run() {
	echo "+ sudo $*"
	sudo "$@"
}

default_vm_name() {
	case "$1" in
		ubuntu|ubuntu-noble) echo "dora-ubuntu-noble" ;;
		arch|archlinux) echo "dora-archlinux" ;;
		windows|windows11) echo "dora-windows11" ;;
		*) die "Unknown profile: $1" ;;
	esac
}

base_image_path() {
	case "$1" in
		ubuntu|ubuntu-noble) echo "$LAB_DIR/images/$UBUNTU_PROFILE-amd64.img" ;;
		arch|archlinux) echo "$LAB_DIR/images/$ARCH_PROFILE-amd64.qcow2" ;;
		*) die "No base image for profile: $1" ;;
	esac
}

base_image_url() {
	case "$1" in
		ubuntu|ubuntu-noble) echo "$UBUNTU_URL" ;;
		arch|archlinux) echo "$ARCH_URL" ;;
		*) die "No base image URL for profile: $1" ;;
	esac
}

vm_dir() {
	echo "$LAB_DIR/vms/$1"
}

vm_disk_path() {
	echo "$(vm_dir "$1")/disk.qcow2"
}

vm_seed_iso_path() {
	echo "$(vm_dir "$1")/seed.iso"
}

vm_credentials_path() {
	echo "$(vm_dir "$1")/credentials.env"
}

vm_user_data_path() {
	echo "$(vm_dir "$1")/user-data"
}

vm_meta_data_path() {
	echo "$(vm_dir "$1")/meta-data"
}

random_password() {
	python3 - <<'PY'
import secrets
print(secrets.token_urlsafe(18))
PY
}

ssh_public_key() {
	local explicit="${1:-}"
	if [[ -n "$explicit" ]]; then
		cat "$explicit"
		return 0
	fi
	for key in "$HOME/.ssh/id_ed25519.pub" "$HOME/.ssh/id_rsa.pub"; do
		if [[ -f "$key" ]]; then
			cat "$key"
			return 0
		fi
	done
	return 1
}

ensure_host_tools() {
	require_cmd apt-get
	sudo_run apt-get update
	sudo_run apt-get install -y \
		qemu-kvm \
		libvirt-daemon-system \
		libvirt-clients \
		virtinst \
		virt-viewer \
		qemu-utils \
		cloud-image-utils \
		genisoimage \
		ovmf \
		swtpm \
		swtpm-tools \
		curl \
		wget \
		cpu-checker
	sudo_run systemctl enable --now libvirtd
	sudo_run virsh net-start "$NETWORK" || true
	sudo_run virsh net-autostart "$NETWORK" || true
	sudo_run usermod -aG libvirt,kvm "$USER" || true
	green "Host VM dependencies installed."
	yellow "If you were newly added to the libvirt/kvm groups, log out and back in before using the VMs without sudo."
}

download_profile_image() {
	local profile="$1"
	local out
	local url

	case "$profile" in
		ubuntu|ubuntu-noble|arch|archlinux) ;;
		*) die "Download is only supported for ubuntu and arch profiles." ;;
	esac

	require_cmd curl
	out="$(base_image_path "$profile")"
	url="$(base_image_url "$profile")"
	mkdir -p "$(dirname "$out")"

	if [[ -f "$out" ]]; then
		yellow "Base image already exists: $out"
		return 0
	fi

	run curl -fL "$url" -o "$out"
	green "Downloaded $(basename "$out")"
}

qemu_image_format() {
	require_cmd qemu-img
	qemu-img info "$1" | awk -F': ' '/file format/ {print $2; exit}'
}

create_overlay_disk() {
	local base="$1"
	local target="$2"
	local size_gb="$3"
	local fmt
	fmt="$(qemu_image_format "$base")"
	mkdir -p "$(dirname "$target")"
	if [[ -f "$target" ]]; then
		yellow "Disk already exists: $target"
		return 0
	fi
	run qemu-img create -f qcow2 -F "$fmt" -b "$base" "$target" "${size_gb}G"
}

write_linux_cloud_init() {
	local name="$1"
	local profile="$2"
	local username="$3"
	local password="$4"
	local ssh_key_path="${5:-}"
	local key_line=""
	local user_data meta_data

	mkdir -p "$(vm_dir "$name")"
	user_data="$(vm_user_data_path "$name")"
	meta_data="$(vm_meta_data_path "$name")"

	if key_line="$(ssh_public_key "$ssh_key_path" 2>/dev/null)"; then
		key_line="    - ${key_line}"
	fi

	cat >"$meta_data" <<EOF
instance-id: ${name}
local-hostname: ${name}
EOF

	if [[ "$profile" == "ubuntu" || "$profile" == "ubuntu-noble" ]]; then
		cat >"$user_data" <<EOF
#cloud-config
users:
  - name: ${username}
    groups: [adm, sudo]
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    lock_passwd: false
$( [[ -n "$key_line" ]] && printf '    ssh_authorized_keys:\n%s\n' "$key_line" )
chpasswd:
  expire: false
  users:
    - name: ${username}
      password: ${password}
ssh_pwauth: true
package_update: true
packages:
  - qemu-guest-agent
  - git
  - curl
runcmd:
  - [ systemctl, enable, --now, qemu-guest-agent ]
EOF
	else
		cat >"$user_data" <<EOF
#cloud-config
users:
  - name: ${username}
    groups: [wheel]
    sudo: ALL=(ALL) NOPASSWD:ALL
    shell: /bin/bash
    lock_passwd: false
$( [[ -n "$key_line" ]] && printf '    ssh_authorized_keys:\n%s\n' "$key_line" )
chpasswd:
  expire: false
  users:
    - name: ${username}
      password: ${password}
ssh_pwauth: true
runcmd:
  - [ bash, -lc, "pacman -Sy --noconfirm qemu-guest-agent git curl sudo base-devel || true" ]
  - [ systemctl, enable, --now, qemu-guest-agent ]
EOF
	fi

	run cloud-localds "$(vm_seed_iso_path "$name")" "$user_data" "$meta_data"
	cat >"$(vm_credentials_path "$name")" <<EOF
PROFILE=${profile}
VM_NAME=${name}
VM_USER=${username}
VM_PASSWORD=${password}
EOF
}

ensure_linux_vm() {
	local profile="$1"
	local name="${2:-$(default_vm_name "$profile")}"
	local memory_mb="${3:-$DEFAULT_MEMORY_MB}"
	local vcpus="${4:-$DEFAULT_VCPUS}"
	local disk_gb="${5:-$DEFAULT_DISK_GB}"
	local ssh_key="${6:-}"
	local base disk password

	for tool in virt-install virsh qemu-img cloud-localds; do
		require_cmd "$tool"
	done

	download_profile_image "$profile"
	base="$(base_image_path "$profile")"
	disk="$(vm_disk_path "$name")"
	password="$(random_password)"

	create_overlay_disk "$base" "$disk" "$disk_gb"
	write_linux_cloud_init "$name" "$profile" "$DEFAULT_USER" "$password" "$ssh_key"

	if virsh -c "$URI" dominfo "$name" >/dev/null 2>&1; then
		yellow "VM already exists in libvirt: $name"
		return 0
	fi

	run virt-install \
		--connect "$URI" \
		--name "$name" \
		--memory "$memory_mb" \
		--vcpus "$vcpus" \
		--import \
		--osinfo detect=on,require=off \
		--disk "path=$disk,format=qcow2,bus=virtio" \
		--disk "path=$(vm_seed_iso_path "$name"),device=cdrom" \
		--network "network=$NETWORK,model=virtio" \
		--graphics spice \
		--video virtio \
		--rng /dev/urandom \
		--channel unix,target.type=virtio,target.name=org.qemu.guest_agent.0 \
		--noautoconsole

	green "Created VM: $name"
	yellow "Credentials saved to $(vm_credentials_path "$name")"
}

ensure_windows_vm() {
	local name="${1:-$(default_vm_name windows11)}"
	local iso_path="${2:-}"
	local virtio_iso="${3:-}"
	local memory_mb="${4:-$DEFAULT_WINDOWS_MEMORY_MB}"
	local vcpus="${5:-$DEFAULT_WINDOWS_VCPUS}"
	local disk_gb="${6:-$DEFAULT_WINDOWS_DISK_GB}"
	local disk

	for tool in virt-install virsh qemu-img; do
		require_cmd "$tool"
	done

	[[ -n "$iso_path" ]] || die "Windows creation requires --iso /path/to/windows.iso"
	[[ -f "$iso_path" ]] || die "Windows ISO not found: $iso_path"

	disk="$(vm_disk_path "$name")"
	mkdir -p "$(vm_dir "$name")"
	if [[ ! -f "$disk" ]]; then
		run qemu-img create -f qcow2 "$disk" "${disk_gb}G"
	fi

	if virsh -c "$URI" dominfo "$name" >/dev/null 2>&1; then
		yellow "VM already exists in libvirt: $name"
		return 0
	fi

	local args=(
		--connect "$URI"
		--name "$name"
		--memory "$memory_mb"
		--vcpus "$vcpus"
		--cpu host-passthrough
		--osinfo detect=on,require=off
		--disk "path=$disk,format=qcow2,bus=virtio"
		--cdrom "$iso_path"
		--network "network=$NETWORK,model=virtio"
		--graphics spice
		--video qxl
		--boot uefi
		--features smm.state=on
		--tpm backend.type=emulator,backend.version=2.0,model=tpm-crb
		--noautoconsole
	)

	if [[ -n "$virtio_iso" ]]; then
		[[ -f "$virtio_iso" ]] || die "VirtIO ISO not found: $virtio_iso"
		args+=(--disk "path=$virtio_iso,device=cdrom")
	fi

	run virt-install "${args[@]}"
	green "Created Windows VM scaffold: $name"
	yellow "Finish the Windows install through virt-viewer or virt-manager."
}

start_vm() {
	require_cmd virsh
	run virsh -c "$URI" start "$1" || true
}

stop_vm() {
	require_cmd virsh
	run virsh -c "$URI" shutdown "$1" || true
}

destroy_vm() {
	require_cmd virsh
	local name="$1"
	virsh -c "$URI" destroy "$name" >/dev/null 2>&1 || true
	virsh -c "$URI" undefine "$name" --nvram >/dev/null 2>&1 || virsh -c "$URI" undefine "$name" >/dev/null 2>&1 || true
	rm -rf "$(vm_dir "$name")"
	green "Deleted VM and managed files for $name"
}

list_vms() {
	require_cmd virsh
	run virsh -c "$URI" list --all
}

vm_ip() {
	require_cmd virsh
	local name="$1"
	virsh -c "$URI" domifaddr "$name" --source lease | awk '/ipv4/ {print $4}' | cut -d/ -f1 | head -n1
}

status_vm() {
	require_cmd virsh
	local name="$1"
	run virsh -c "$URI" dominfo "$name"
	local ip
	ip="$(vm_ip "$name" || true)"
	if [[ -n "$ip" ]]; then
		echo "IP: $ip"
	fi
}

ssh_vm() {
	local name="$1"
	local creds_file ip user
	creds_file="$(vm_credentials_path "$name")"
	[[ -f "$creds_file" ]] || die "Credentials file not found for $name: $creds_file"
	# shellcheck disable=SC1090
	source "$creds_file"
	user="${VM_USER:-$DEFAULT_USER}"
	ip="$(vm_ip "$name" || true)"
	[[ -n "$ip" ]] || die "Could not determine IP for $name. Try again after the VM fully boots."
	run ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null "${user}@${ip}"
}

console_vm() {
	require_cmd virsh
	yellow "Use Ctrl+] to leave the serial console."
	run virsh -c "$URI" console "$1"
}

open_vm() {
	require_cmd virt-viewer
	run virt-viewer --connect "$URI" "$1"
}

show_credentials() {
	local file
	file="$(vm_credentials_path "$1")"
	[[ -f "$file" ]] || die "Credentials file not found: $file"
	cat "$file"
}

print_help() {
	cat <<EOF
VM lab for Dora packaging on Ubuntu hosts

Usage:
  bash tools/scripts/vm-lab.sh setup-host
  bash tools/scripts/vm-lab.sh download <ubuntu|arch>
  bash tools/scripts/vm-lab.sh create <ubuntu|arch> [--name NAME] [--ssh-key PATH]
  bash tools/scripts/vm-lab.sh create windows --iso /path/to/windows.iso [--virtio-iso /path/to/virtio.iso] [--name NAME]
  bash tools/scripts/vm-lab.sh list
  bash tools/scripts/vm-lab.sh status <name>
  bash tools/scripts/vm-lab.sh start <name>
  bash tools/scripts/vm-lab.sh stop <name>
  bash tools/scripts/vm-lab.sh delete <name>
  bash tools/scripts/vm-lab.sh ip <name>
  bash tools/scripts/vm-lab.sh ssh <name>
  bash tools/scripts/vm-lab.sh console <name>
  bash tools/scripts/vm-lab.sh open <name>
  bash tools/scripts/vm-lab.sh creds <name>

Notes:
  - Linux VMs use cloud images and auto-generate local credentials.
  - Windows VM creation is scaffolded but expects a local ISO because Microsoft download flows are not stable enough to hardcode.
  - Managed files live under: $LAB_DIR
EOF
}

menu() {
	while true; do
		printf '\n'
		blue "Dora VM Lab"
		printf '1. Setup host dependencies\n'
		printf '2. Download Ubuntu image\n'
		printf '3. Download Arch image\n'
		printf '4. Create Ubuntu VM\n'
		printf '5. Create Arch VM\n'
		printf '6. Create Windows VM\n'
		printf '7. List VMs\n'
		printf '8. Exit\n'
		printf 'Choice: '
		read -r choice
		case "$choice" in
			1) ensure_host_tools ;;
			2) download_profile_image ubuntu ;;
			3) download_profile_image arch ;;
			4) ensure_linux_vm ubuntu ;;
			5) ensure_linux_vm arch ;;
			6)
				printf 'Windows ISO path: '
				read -r iso
				printf 'VirtIO ISO path (optional): '
				read -r virtio
				ensure_windows_vm "$(default_vm_name windows11)" "$iso" "$virtio"
				;;
			7) list_vms ;;
			8) exit 0 ;;
			*) yellow "Unknown choice." ;;
		esac
	done
}

parse_create() {
	local profile="$1"
	shift
	local name=""
	local ssh_key=""
	local iso=""
	local virtio_iso=""

	while [[ $# -gt 0 ]]; do
		case "$1" in
			--name) name="$2"; shift 2 ;;
			--ssh-key) ssh_key="$2"; shift 2 ;;
			--iso) iso="$2"; shift 2 ;;
			--virtio-iso) virtio_iso="$2"; shift 2 ;;
			*) die "Unknown flag for create: $1" ;;
		esac
	done

	if [[ "$profile" == "windows" || "$profile" == "windows11" ]]; then
		ensure_windows_vm "${name:-$(default_vm_name windows11)}" "$iso" "$virtio_iso"
	else
		ensure_linux_vm "$profile" "${name:-$(default_vm_name "$profile")}" "$DEFAULT_MEMORY_MB" "$DEFAULT_VCPUS" "$DEFAULT_DISK_GB" "$ssh_key"
	fi
}

main() {
	cd "$ROOT_DIR"

	if [[ $# -eq 0 ]]; then
		menu
	fi

	case "$1" in
		setup-host|install-host)
			ensure_host_tools
			;;
		download)
			[[ $# -ge 2 ]] || die "Usage: vm-lab.sh download <ubuntu|arch>"
			download_profile_image "$2"
			;;
		create)
			[[ $# -ge 2 ]] || die "Usage: vm-lab.sh create <ubuntu|arch|windows> [flags]"
			parse_create "$2" "${@:3}"
			;;
		list)
			list_vms
			;;
		status)
			[[ $# -eq 2 ]] || die "Usage: vm-lab.sh status <name>"
			status_vm "$2"
			;;
		start)
			[[ $# -eq 2 ]] || die "Usage: vm-lab.sh start <name>"
			start_vm "$2"
			;;
		stop)
			[[ $# -eq 2 ]] || die "Usage: vm-lab.sh stop <name>"
			stop_vm "$2"
			;;
		delete)
			[[ $# -eq 2 ]] || die "Usage: vm-lab.sh delete <name>"
			destroy_vm "$2"
			;;
		ip)
			[[ $# -eq 2 ]] || die "Usage: vm-lab.sh ip <name>"
			vm_ip "$2"
			;;
		ssh)
			[[ $# -eq 2 ]] || die "Usage: vm-lab.sh ssh <name>"
			ssh_vm "$2"
			;;
		console)
			[[ $# -eq 2 ]] || die "Usage: vm-lab.sh console <name>"
			console_vm "$2"
			;;
		open)
			[[ $# -eq 2 ]] || die "Usage: vm-lab.sh open <name>"
			open_vm "$2"
			;;
		creds)
			[[ $# -eq 2 ]] || die "Usage: vm-lab.sh creds <name>"
			show_credentials "$2"
			;;
		help|-h|--help)
			print_help
			;;
		*)
			die "Unknown command: $1"
			;;
	esac
}

main "$@"

# VM Lab

Use the VM lab script on an Ubuntu LTS host to bootstrap and manage the guest OSes needed for package-manager work.

Run it with:

```bash
bash tools/scripts/vm-lab.sh
```

Or call subcommands directly:

```bash
bash tools/scripts/vm-lab.sh setup-host
bash tools/scripts/vm-lab.sh create ubuntu
bash tools/scripts/vm-lab.sh create arch
bash tools/scripts/vm-lab.sh create windows --iso ~/Downloads/Win11.iso
```

What it covers:

- installs KVM/libvirt/virt-install/cloud image tooling on Ubuntu
- downloads official Ubuntu and Arch cloud images
- creates Linux VMs with cloud-init, generated credentials, and optional SSH key injection
- scaffolds a Windows 11 VM from a local ISO
- starts, stops, opens, deletes, and SSHes into managed VMs

Managed files live under `.cache/dora-vm-lab/`.

Useful commands:

```bash
bash tools/scripts/vm-lab.sh list
bash tools/scripts/vm-lab.sh status dora-ubuntu-noble
bash tools/scripts/vm-lab.sh ip dora-archlinux
bash tools/scripts/vm-lab.sh creds dora-archlinux
bash tools/scripts/vm-lab.sh ssh dora-archlinux
```

Notes:

- `setup-host` may add your user to the `libvirt` and `kvm` groups. If so, log out and back in once.
- Windows creation is intentionally ISO-based rather than auto-download because Microsoft download URLs and licensing flows are not stable enough to hardcode.
- Snap does not require a dedicated VM if your Ubuntu host can run `snapcraft`.

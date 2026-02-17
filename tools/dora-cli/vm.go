package main

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
	"time"
)

const defaultVMConfigPath = ".dora-vm.yaml"

type vmConfig struct {
	Name            string `yaml:"name"`
	URI             string `yaml:"uri"`
	StorageDir      string `yaml:"storage_dir"`
	BaseImage       string `yaml:"base_image"`
	BaseImageURL    string `yaml:"base_image_url"`
	OverlayImage    string `yaml:"overlay_image"`
	SeedISO         string `yaml:"seed_iso"`
	DomainXML       string `yaml:"domain_xml"`
	SerialLog       string `yaml:"serial_log"`
	MemoryMB        int    `yaml:"memory_mb"`
	VCPUs           int    `yaml:"vcpus"`
	DiskSizeGB      int    `yaml:"disk_size_gb"`
	Network         string `yaml:"network"`
	GuestShell      string `yaml:"guest_shell"`
	GuestRunCommand string `yaml:"guest_run_command"`
	AgentTimeoutSec int    `yaml:"agent_timeout_sec"`
}

func defaultVMConfig() vmConfig {
	root := findProjectRoot()
	storage := filepath.Join(root, ".cache", "dora-vm")
	return vmConfig{
		Name:            "dora-windows-test",
		URI:             "qemu:///system",
		StorageDir:      storage,
		BaseImage:       filepath.Join(storage, "base.qcow2"),
		BaseImageURL:    "",
		OverlayImage:    filepath.Join(storage, "overlay.qcow2"),
		SeedISO:         filepath.Join(storage, "seed.iso"),
		DomainXML:       filepath.Join(storage, "domain.xml"),
		SerialLog:       filepath.Join(storage, "serial.log"),
		MemoryMB:        8192,
		VCPUs:           4,
		DiskSizeGB:      80,
		Network:         "default",
		GuestShell:      "cmd.exe /c",
		GuestRunCommand: "powershell -ExecutionPolicy Bypass -File C:\\ci\\run-tests.ps1",
		AgentTimeoutSec: 180,
	}
}

func runVMCommand(args []string) error {
	if runtime.GOOS == "windows" {
		return errors.New("vm module is only supported on Linux hosts with KVM/libvirt")
	}
	if len(args) == 0 {
		return errors.New("missing vm subcommand (expected: init|ensure|run|logs|clean|nuke)")
	}

	sub := args[0]
	fs := flag.NewFlagSet("vm "+sub, flag.ContinueOnError)
	fs.SetOutput(os.Stderr)
	configPath := fs.String("config", defaultVMConfigPath, "Path to VM YAML config")
	command := fs.String("command", "", "Command to execute in guest for vm run")
	noStart := fs.Bool("no-start", false, "Define VM assets but do not start VM")
	if err := fs.Parse(args[1:]); err != nil {
		return err
	}

	cfgPath := resolveConfigPath(*configPath)

	switch sub {
	case "init":
		return vmInit(cfgPath)
	case "ensure":
		cfg, err := loadVMConfig(cfgPath)
		if err != nil {
			return err
		}
		return vmEnsure(cfg, *noStart)
	case "run":
		cfg, err := loadVMConfig(cfgPath)
		if err != nil {
			return err
		}
		runCmd := strings.TrimSpace(*command)
		if runCmd == "" {
			runCmd = strings.TrimSpace(cfg.GuestRunCommand)
		}
		if runCmd == "" {
			return errors.New("no run command specified: set guest_run_command in config or pass --command")
		}
		if err := vmEnsure(cfg, false); err != nil {
			return err
		}
		return vmRun(cfg, runCmd)
	case "logs":
		cfg, err := loadVMConfig(cfgPath)
		if err != nil {
			return err
		}
		return vmLogs(cfg)
	case "clean":
		cfg, err := loadVMConfig(cfgPath)
		if err != nil {
			return err
		}
		return vmClean(cfg)
	case "nuke":
		cfg, err := loadVMConfig(cfgPath)
		if err != nil {
			return err
		}
		return vmNuke(cfg)
	default:
		return fmt.Errorf("unknown vm subcommand %q", sub)
	}
}

func resolveConfigPath(path string) string {
	if filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(findProjectRoot(), path)
}

func vmInit(configPath string) error {
	if _, err := os.Stat(configPath); errors.Is(err, os.ErrNotExist) {
		cfg := defaultVMConfig()
		if err := writeVMConfig(configPath, cfg); err != nil {
			return err
		}
		fmt.Printf("Created VM config: %s\n", configPath)
	}

	cfg, err := loadVMConfig(configPath)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(cfg.StorageDir, 0o755); err != nil {
		return err
	}
	if err := maybeFetchBaseImage(cfg); err != nil {
		return err
	}
	if err := ensureCloudInitSeed(cfg); err != nil {
		return err
	}
	fmt.Printf("VM storage ready: %s\n", cfg.StorageDir)
	return nil
}

func maybeFetchBaseImage(cfg vmConfig) error {
	if _, err := os.Stat(cfg.BaseImage); err == nil {
		return nil
	}
	if strings.TrimSpace(cfg.BaseImageURL) == "" {
		fmt.Printf("Base image not found at %s. Set base_image_url to auto-download or place the file manually.\n", cfg.BaseImage)
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(cfg.BaseImage), 0o755); err != nil {
		return err
	}
	fmt.Printf("Downloading base image from %s...\n", cfg.BaseImageURL)
	if _, err := exec.LookPath("curl"); err == nil {
		return runCommandStreaming("curl", "-fL", "-o", cfg.BaseImage, cfg.BaseImageURL)
	}
	if _, err := exec.LookPath("wget"); err == nil {
		return runCommandStreaming("wget", "-O", cfg.BaseImage, cfg.BaseImageURL)
	}
	return errors.New("need curl or wget to download base image")
}

func ensureCloudInitSeed(cfg vmConfig) error {
	if _, err := os.Stat(cfg.SeedISO); err == nil {
		return nil
	}
	if _, err := exec.LookPath("cloud-localds"); err != nil {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(cfg.SeedISO), 0o755); err != nil {
		return err
	}
	meta := "instance-id: dora-vm\nlocal-hostname: dora-vm\n"
	user := strings.Join([]string{
		"#cloud-config",
		"package_update: true",
		"packages:",
		"  - qemu-guest-agent",
		"runcmd:",
		"  - [ systemctl, enable, --now, qemu-guest-agent ]",
		"  - [ mkdir, -p, /ci ]",
	}, "\n") + "\n"
	metaPath := filepath.Join(cfg.StorageDir, "meta-data")
	userPath := filepath.Join(cfg.StorageDir, "user-data")
	if err := os.WriteFile(metaPath, []byte(meta), 0o644); err != nil {
		return err
	}
	if err := os.WriteFile(userPath, []byte(user), 0o644); err != nil {
		return err
	}
	return runCommandStreaming("cloud-localds", cfg.SeedISO, userPath, metaPath)
}

func vmEnsure(cfg vmConfig, noStart bool) error {
	if err := validateVMConfig(cfg); err != nil {
		return err
	}
	if err := os.MkdirAll(cfg.StorageDir, 0o755); err != nil {
		return err
	}
	if err := maybeFetchBaseImage(cfg); err != nil {
		return err
	}
	if err := ensureCloudInitSeed(cfg); err != nil {
		return err
	}
	if _, err := os.Stat(cfg.BaseImage); err != nil {
		return fmt.Errorf("base image missing after init: %s", cfg.BaseImage)
	}
	if err := ensureOverlayDisk(cfg); err != nil {
		return err
	}
	if err := writeDomainXML(cfg); err != nil {
		return err
	}
	if err := ensureDefined(cfg); err != nil {
		return err
	}
	if noStart {
		fmt.Println("VM assets ensured (not started because --no-start was used).")
		return nil
	}
	if err := ensureStarted(cfg); err != nil {
		return err
	}
	fmt.Printf("VM ensured and running: %s\n", cfg.Name)
	return nil
}

func validateVMConfig(cfg vmConfig) error {
	if cfg.Name == "" {
		return errors.New("config error: name is required")
	}
	if cfg.URI == "" {
		return errors.New("config error: uri is required")
	}
	if cfg.StorageDir == "" || cfg.BaseImage == "" || cfg.OverlayImage == "" || cfg.DomainXML == "" {
		return errors.New("config error: storage_dir/base_image/overlay_image/domain_xml are required")
	}
	if cfg.MemoryMB <= 0 || cfg.VCPUs <= 0 {
		return errors.New("config error: memory_mb and vcpus must be > 0")
	}
	return nil
}

func ensureOverlayDisk(cfg vmConfig) error {
	if _, err := os.Stat(cfg.OverlayImage); err == nil {
		return nil
	}
	if err := os.MkdirAll(filepath.Dir(cfg.OverlayImage), 0o755); err != nil {
		return err
	}
	args := []string{"create", "-f", "qcow2", "-F", "qcow2", "-b", cfg.BaseImage, cfg.OverlayImage}
	if cfg.DiskSizeGB > 0 {
		args = append(args, fmt.Sprintf("%dG", cfg.DiskSizeGB))
	}
	return runCommandStreaming("qemu-img", args...)
}

func writeDomainXML(cfg vmConfig) error {
	xml := renderDomainXML(cfg)
	if err := os.MkdirAll(filepath.Dir(cfg.DomainXML), 0o755); err != nil {
		return err
	}
	return os.WriteFile(cfg.DomainXML, []byte(xml), 0o644)
}

func renderDomainXML(cfg vmConfig) string {
	seedDisk := ""
	if _, err := os.Stat(cfg.SeedISO); err == nil {
		seedDisk = fmt.Sprintf(`
    <disk type='file' device='cdrom'>
      <driver name='qemu' type='raw'/>
      <source file='%s'/>
      <target dev='sda' bus='sata'/>
      <readonly/>
    </disk>`, escapeXML(cfg.SeedISO))
	}

	return fmt.Sprintf(`<domain type='kvm'>
  <name>%s</name>
  <memory unit='MiB'>%d</memory>
  <vcpu>%d</vcpu>
  <os>
    <type arch='x86_64' machine='pc-q35-8.2'>hvm</type>
    <boot dev='hd'/>
  </os>
  <features>
    <acpi/>
    <apic/>
  </features>
  <cpu mode='host-passthrough'/>
  <devices>
    <emulator>/usr/bin/qemu-system-x86_64</emulator>
    <disk type='file' device='disk'>
      <driver name='qemu' type='qcow2'/>
      <source file='%s'/>
      <target dev='vda' bus='virtio'/>
    </disk>%s
    <interface type='network'>
      <source network='%s'/>
      <model type='virtio'/>
    </interface>
    <channel type='unix'>
      <target type='virtio' name='org.qemu.guest_agent.0'/>
    </channel>
    <serial type='file'>
      <source path='%s'/>
      <target port='0'/>
    </serial>
    <console type='pty'>
      <target type='serial' port='0'/>
    </console>
    <graphics type='none'/>
  </devices>
</domain>
`, escapeXML(cfg.Name), cfg.MemoryMB, cfg.VCPUs, escapeXML(cfg.OverlayImage), seedDisk, escapeXML(cfg.Network), escapeXML(cfg.SerialLog))
}

func escapeXML(value string) string {
	replacer := strings.NewReplacer("&", "&amp;", "<", "&lt;", ">", "&gt;", "\"", "&quot;", "'", "&apos;")
	return replacer.Replace(value)
}

func ensureDefined(cfg vmConfig) error {
	if err := runCommandStreaming("virsh", "-c", cfg.URI, "dominfo", cfg.Name); err == nil {
		return nil
	}
	return runCommandStreaming("virsh", "-c", cfg.URI, "define", cfg.DomainXML)
}

func ensureStarted(cfg vmConfig) error {
	state, err := captureCommand("virsh", "-c", cfg.URI, "domstate", cfg.Name)
	if err == nil && strings.Contains(strings.ToLower(state), "running") {
		return nil
	}
	if err := runCommandStreaming("virsh", "-c", cfg.URI, "start", cfg.Name); err != nil {
		// If already active, continue.
		if !strings.Contains(strings.ToLower(err.Error()), "already active") {
			return err
		}
	}
	return nil
}

func vmRun(cfg vmConfig, command string) error {
	deadline := time.Now().Add(time.Duration(cfg.AgentTimeoutSec) * time.Second)
	if cfg.AgentTimeoutSec <= 0 {
		deadline = time.Now().Add(180 * time.Second)
	}
	for {
		if time.Now().After(deadline) {
			return errors.New("timed out waiting for qemu guest agent")
		}
		if err := guestAgentPing(cfg); err == nil {
			break
		}
		time.Sleep(2 * time.Second)
	}

	pid, err := guestExec(cfg, command)
	if err != nil {
		return err
	}
	for {
		status, err := guestExecStatus(cfg, pid)
		if err != nil {
			return err
		}
		if exited, _ := status["exited"].(bool); exited {
			stdout, _ := decodeGuestOutput(status["out-data"])
			stderr, _ := decodeGuestOutput(status["err-data"])
			if strings.TrimSpace(stdout) != "" {
				fmt.Print(stdout)
				if !strings.HasSuffix(stdout, "\n") {
					fmt.Println()
				}
			}
			if strings.TrimSpace(stderr) != "" {
				fmt.Fprint(os.Stderr, stderr)
				if !strings.HasSuffix(stderr, "\n") {
					fmt.Fprintln(os.Stderr)
				}
			}
			exitCode := 1
			if raw, ok := status["exitcode"]; ok {
				switch v := raw.(type) {
				case float64:
					exitCode = int(v)
				case int:
					exitCode = v
				}
			}
			if exitCode != 0 {
				return fmt.Errorf("guest command failed with exit code %d", exitCode)
			}
			fmt.Println("Guest command completed successfully.")
			return nil
		}
		time.Sleep(1 * time.Second)
	}
}

func guestAgentPing(cfg vmConfig) error {
	payload := `{"execute":"guest-ping"}`
	_, err := captureCommand("virsh", "-c", cfg.URI, "qemu-agent-command", cfg.Name, payload)
	return err
}

func guestExec(cfg vmConfig, command string) (int, error) {
	path, shellArgs := parseGuestShell(cfg.GuestShell)
	request := map[string]any{
		"execute": "guest-exec",
		"arguments": map[string]any{
			"path":           path,
			"arg":            append(shellArgs, command),
			"capture-output": true,
		},
	}
	data, _ := json.Marshal(request)
	out, err := captureCommand("virsh", "-c", cfg.URI, "qemu-agent-command", cfg.Name, string(data))
	if err != nil {
		return 0, err
	}
	resp := map[string]map[string]any{}
	if err := json.Unmarshal([]byte(out), &resp); err != nil {
		return 0, err
	}
	ret, ok := resp["return"]
	if !ok {
		return 0, errors.New("missing return object in guest-exec response")
	}
	rawPID, ok := ret["pid"]
	if !ok {
		return 0, errors.New("missing pid in guest-exec response")
	}
	switch v := rawPID.(type) {
	case float64:
		return int(v), nil
	case int:
		return v, nil
	default:
		return 0, errors.New("invalid pid type in guest-exec response")
	}
}

func guestExecStatus(cfg vmConfig, pid int) (map[string]any, error) {
	request := map[string]any{
		"execute": "guest-exec-status",
		"arguments": map[string]any{
			"pid": pid,
		},
	}
	data, _ := json.Marshal(request)
	out, err := captureCommand("virsh", "-c", cfg.URI, "qemu-agent-command", cfg.Name, string(data))
	if err != nil {
		return nil, err
	}
	resp := map[string]map[string]any{}
	if err := json.Unmarshal([]byte(out), &resp); err != nil {
		return nil, err
	}
	ret, ok := resp["return"]
	if !ok {
		return nil, errors.New("missing return object in guest-exec-status response")
	}
	return ret, nil
}

func decodeGuestOutput(raw any) (string, error) {
	s, ok := raw.(string)
	if !ok || s == "" {
		return "", nil
	}
	decoded, err := base64.StdEncoding.DecodeString(s)
	if err != nil {
		return "", err
	}
	return string(decoded), nil
}

func vmLogs(cfg vmConfig) error {
	fmt.Printf("Domain: %s\n", cfg.Name)
	fmt.Printf("URI: %s\n", cfg.URI)
	if out, err := captureCommand("virsh", "-c", cfg.URI, "domstate", cfg.Name); err == nil {
		fmt.Printf("State: %s\n", strings.TrimSpace(out))
	}
	if _, err := os.Stat(cfg.SerialLog); err == nil {
		fmt.Printf("Serial log: %s\n", cfg.SerialLog)
		return runCommandStreaming("tail", "-n", "200", cfg.SerialLog)
	}
	fmt.Printf("Serial log does not exist yet: %s\n", cfg.SerialLog)
	return nil
}

func vmClean(cfg vmConfig) error {
	_ = runCommandStreaming("virsh", "-c", cfg.URI, "shutdown", cfg.Name)
	_ = runCommandStreaming("virsh", "-c", cfg.URI, "destroy", cfg.Name)
	_ = os.Remove(cfg.OverlayImage)
	_ = os.Remove(cfg.SeedISO)
	_ = os.Remove(cfg.SerialLog)
	fmt.Println("VM cleaned (overlay/seed/log removed).")
	return nil
}

func vmNuke(cfg vmConfig) error {
	_ = runCommandStreaming("virsh", "-c", cfg.URI, "shutdown", cfg.Name)
	_ = runCommandStreaming("virsh", "-c", cfg.URI, "destroy", cfg.Name)
	_ = runCommandStreaming("virsh", "-c", cfg.URI, "undefine", cfg.Name, "--nvram")
	if err := safeRemoveAll(cfg.StorageDir); err != nil {
		return err
	}
	fmt.Printf("VM nuked and storage removed: %s\n", cfg.StorageDir)
	return nil
}

func safeRemoveAll(path string) error {
	clean := filepath.Clean(path)
	if clean == "/" || clean == "." || clean == "" {
		return fmt.Errorf("refusing to remove unsafe path %q", path)
	}
	return os.RemoveAll(clean)
}

func loadVMConfig(path string) (vmConfig, error) {
	cfg := defaultVMConfig()
	data, err := os.ReadFile(path)
	if err != nil {
		return cfg, err
	}
	if err := parseVMConfigYAML(data, &cfg); err != nil {
		return cfg, err
	}
	if !filepath.IsAbs(cfg.StorageDir) {
		cfg.StorageDir = filepath.Join(findProjectRoot(), cfg.StorageDir)
	}
	cfg.BaseImage = absolutizeVMPath(cfg.BaseImage)
	cfg.OverlayImage = absolutizeVMPath(cfg.OverlayImage)
	cfg.SeedISO = absolutizeVMPath(cfg.SeedISO)
	cfg.DomainXML = absolutizeVMPath(cfg.DomainXML)
	cfg.SerialLog = absolutizeVMPath(cfg.SerialLog)
	return cfg, nil
}

func absolutizeVMPath(path string) string {
	if path == "" || filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(findProjectRoot(), path)
}

func writeVMConfig(path string, cfg vmConfig) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(renderVMConfigYAML(cfg)), 0o644)
}

func parseVMConfigYAML(data []byte, cfg *vmConfig) error {
	scanner := bufio.NewScanner(bytes.NewReader(data))
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, ":", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		value := strings.Trim(strings.TrimSpace(parts[1]), `"'`)

		switch key {
		case "name":
			cfg.Name = value
		case "uri":
			cfg.URI = value
		case "storage_dir":
			cfg.StorageDir = value
		case "base_image":
			cfg.BaseImage = value
		case "base_image_url":
			cfg.BaseImageURL = value
		case "overlay_image":
			cfg.OverlayImage = value
		case "seed_iso":
			cfg.SeedISO = value
		case "domain_xml":
			cfg.DomainXML = value
		case "serial_log":
			cfg.SerialLog = value
		case "memory_mb":
			v, err := strconv.Atoi(value)
			if err != nil {
				return fmt.Errorf("invalid memory_mb: %w", err)
			}
			cfg.MemoryMB = v
		case "vcpus":
			v, err := strconv.Atoi(value)
			if err != nil {
				return fmt.Errorf("invalid vcpus: %w", err)
			}
			cfg.VCPUs = v
		case "disk_size_gb":
			v, err := strconv.Atoi(value)
			if err != nil {
				return fmt.Errorf("invalid disk_size_gb: %w", err)
			}
			cfg.DiskSizeGB = v
		case "network":
			cfg.Network = value
		case "guest_shell":
			cfg.GuestShell = value
		case "guest_run_command":
			cfg.GuestRunCommand = value
		case "agent_timeout_sec":
			v, err := strconv.Atoi(value)
			if err != nil {
				return fmt.Errorf("invalid agent_timeout_sec: %w", err)
			}
			cfg.AgentTimeoutSec = v
		}
	}
	return scanner.Err()
}

func renderVMConfigYAML(cfg vmConfig) string {
	var b strings.Builder
	writeKV := func(key, value string) {
		b.WriteString(key)
		b.WriteString(": ")
		b.WriteString(value)
		b.WriteString("\n")
	}
	writeInt := func(key string, value int) {
		b.WriteString(key)
		b.WriteString(": ")
		b.WriteString(strconv.Itoa(value))
		b.WriteString("\n")
	}

	writeKV("name", cfg.Name)
	writeKV("uri", cfg.URI)
	writeKV("storage_dir", cfg.StorageDir)
	writeKV("base_image", cfg.BaseImage)
	writeKV("base_image_url", cfg.BaseImageURL)
	writeKV("overlay_image", cfg.OverlayImage)
	writeKV("seed_iso", cfg.SeedISO)
	writeKV("domain_xml", cfg.DomainXML)
	writeKV("serial_log", cfg.SerialLog)
	writeInt("memory_mb", cfg.MemoryMB)
	writeInt("vcpus", cfg.VCPUs)
	writeInt("disk_size_gb", cfg.DiskSizeGB)
	writeKV("network", cfg.Network)
	writeKV("guest_shell", cfg.GuestShell)
	writeKV("guest_run_command", cfg.GuestRunCommand)
	writeInt("agent_timeout_sec", cfg.AgentTimeoutSec)
	return b.String()
}

func parseGuestShell(shell string) (string, []string) {
	parts := strings.Fields(strings.TrimSpace(shell))
	if len(parts) == 0 {
		return "cmd.exe", []string{"/c"}
	}
	if len(parts) == 1 {
		return parts[0], nil
	}
	return parts[0], parts[1:]
}

func runCommandStreaming(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Stdin = os.Stdin
	return cmd.Run()
}

func captureCommand(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	var out bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr
	err := cmd.Run()
	if err != nil {
		if stderr.Len() > 0 {
			return "", fmt.Errorf("%w: %s", err, strings.TrimSpace(stderr.String()))
		}
		return "", err
	}
	return strings.TrimSpace(out.String()), nil
}

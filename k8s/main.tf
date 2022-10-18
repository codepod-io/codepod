terraform {
  required_providers {
    proxmox = {
      source = "telmate/proxmox"
      version = "2.9.11"
    }
  }
}
provider "proxmox" {
  pm_api_url = "https://10.43.1.108:8006/api2/json" # change this to match your own proxmox
  pm_api_token_id = "YOUR_TOKEN_ID" # change this to match your own proxmox
  pm_api_token_secret = "YOUR_TOKEN_SECRET" # change this to match your own proxmox
  pm_tls_insecure = true
}

resource "proxmox_vm_qemu" "k3s-server" {
  count = 4
  name = "k3s-server-0${count.index}"
  target_node = var.proxmox_host
  # thanks to Brian on YouTube for the vmid tip
  # http://www.youtube.com/channel/UCTbqi6o_0lwdekcp-D6xmWw
  vmid = "18${count.index}"
  clone = var.template_name
  agent = 1
  os_type = "cloud-init"
  cores = 2
  sockets = 1
  cpu = "kvm64"
  memory = 4096
  scsihw = "virtio-scsi-pci"
  bootdisk = "scsi0"
  disk {
    slot = 0
    size = "30G"
    type = "scsi"
    storage = "local-lvm"
    #storage_type = "zfspool"
    iothread = 1
  }
  network {
    model = "virtio"
    bridge = "vmbr0"
  }
  
  # network {
  #   model = "virtio"
  #   bridge = "vmbr17"
  # }
  lifecycle {
    ignore_changes = [
      network,
    ]
  }
  # server IP: 10.43.1.161
  ipconfig0 = "ip=10.43.1.18${count.index}/24,gw=10.43.1.1"
  # ipconfig1 = "ip=10.17.0.4${count.index + 1}/24"
  sshkeys = <<EOF
${var.ssh_key_nvidia}
${var.ssh_key_mac}
  EOF
}

resource "proxmox_vm_qemu" "k3s-agent" {
  count = 4
  name = "k3s-agent-0${count.index}"
  target_node = var.proxmox_host
  vmid = "19${count.index}"
  clone = var.template_name
  agent = 1
  os_type = "cloud-init"
  cores = 2
  sockets = 1
  cpu = "kvm64"
  memory = 4096
  scsihw = "virtio-scsi-pci"
  bootdisk = "scsi0"
  disk {
    slot = 0
    size = "30G"
    type = "scsi"
    storage = "local-lvm"
    #storage_type = "zfspool"
    iothread = 1
  }
  network {
    model = "virtio"
    bridge = "vmbr0"
  }
  
  # network {
  #   model = "virtio"
  #   bridge = "vmbr17"
  # }
  lifecycle {
    ignore_changes = [
      network,
    ]
  }
  # agent IPs: 10.43.1.171, 10.43.1.172
  ipconfig0 = "ip=10.43.1.19${count.index}/24,gw=10.43.1.1"
  # ipconfig1 = "ip=10.17.0.5${count.index + 1}/24"
  sshkeys = <<EOF
${var.ssh_key_nvidia}
${var.ssh_key_mac}
  EOF
}

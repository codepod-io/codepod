variable "ssh_key_nvidia" {
  default = "ssh-rsa YOUR_PUBLIC_SSH_KEY hebi@nvidia"
}
variable "ssh_key_mac" {
  default = "ssh-rsa YOUR_PUBLIC_SSH_KEY hebi@Hebis-MacBook-Pro.local"
}
variable "proxmox_host" {
    default = "o11d"
}
variable "template_name" {
    default = "ubuntu-2204-cloudinit-template"
}
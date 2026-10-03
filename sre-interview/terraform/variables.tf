variable "cluster_name" {
  description = "Name of the kind cluster. The kubectl context is kind-<cluster_name>."
  type        = string
  default     = "sre-interview"
}

variable "node_image" {
  description = <<-EOT
    kind node image, pinned by digest to the Kubernetes 1.35.0 image built for kind
    v0.31.0, the kind version the tehcyx/kind provider embeds. If you bump the
    provider, take a matching digest from the kind release notes:
    https://github.com/kubernetes-sigs/kind/releases
  EOT
  type        = string
  default     = "kindest/node:v1.35.0@sha256:452d707d4862f52530247495d180205e029056831160e22870e37e3f6c1ac31f"
}

variable "published_ports" {
  description = <<-EOT
    Ports the kind node publishes on the host, as host port to NodePort. Each entry
    makes http://localhost:<host> reach a Service of type NodePort pinned to <node>.
    Kubernetes allocates NodePorts from 30000-32767 by default.

    Adding or removing an entry replaces the cluster, because kind can only set port
    mappings when the node container is created. On a disposable local cluster that
    is a rebuild, not a migration, but it does mean deciding these up front is
    cheaper than adding them later.
  EOT
  type = list(object({
    host = number
    node = number
  }))
  default = [
    { host = 8080, node = 30080 },
    { host = 3000, node = 30300 },
  ]
}

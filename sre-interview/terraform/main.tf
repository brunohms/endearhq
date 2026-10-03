resource "kind_cluster" "this" {
  name           = var.cluster_name
  node_image     = var.node_image
  wait_for_ready = true

  kubeconfig_path = abspath("${path.module}/.kubeconfig")

  kind_config {
    kind        = "Cluster"
    api_version = "kind.x-k8s.io/v1alpha4"

    node {
      role = "control-plane"

      dynamic "extra_port_mappings" {
        for_each = var.published_ports
        content {
          host_port      = extra_port_mappings.value.host
          container_port = extra_port_mappings.value.node
          listen_address = "127.0.0.1"
        }
      }
    }
  }
}

output "kubeconfig_path" {
  description = "Kubeconfig for the cluster. mise exports this path as KUBECONFIG."
  value       = kind_cluster.this.kubeconfig_path
}

output "kube_context" {
  description = "kubectl context name for the cluster."
  value       = "kind-${kind_cluster.this.name}"
}

terraform {
  required_version = "~> 1.16"

  required_providers {
    kind = {
      source  = "tehcyx/kind"
      version = "~> 0.11"
    }
  }
}

provider "kind" {}

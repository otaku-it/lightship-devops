export interface Project {
  id: number
  name: string
  description: string
  project_type: 'java' | 'frontend' | 'python'
  repository_url: string
  default_branch: string
  build_command: string
  artifact_pattern: string
  health_path: string
  deployment_mode: 'file' | 'docker'
  dockerfile_path: string
  docker_image_name: string
  docker_container_port: number
  docker_run_args: string
  created_at: string
  release_count: number
  success_rate: number
  credential_configured: boolean
  git_username: string
}

export interface Environment {
  id: number
  name: string
  slug: string
  approval_required: boolean
  release_window: string
  target_count: number
}

export interface DeploymentTarget {
  id: number
  project_id: number
  project_name: string
  environment_id: number
  environment_name: string
  name: string
  connection_type: string
  address: string
  port: number
  username: string
  credential_ref: string
  deploy_path: string
  start_command: string
  health_check_command: string
  status: string
  system_info: string
  created_at: string
  auth_type: 'password' | 'private_key'
  credential_configured: boolean
  host_key_fingerprint: string
  trust_on_first_use: boolean
  service_port: number
}

export interface ReleaseStep {
  id: number
  sequence: number
  name: string
  status: string
  started_at: string | null
  finished_at: string | null
}

export interface ReleaseLog {
  id: number
  level: string
  message: string
  created_at: string
}

export interface ReleaseDeployment {
  id: number
  target_id: number
  target_name: string
  status: string
  deployed_path: string
  previous_path: string
  message: string
  started_at: string | null
  finished_at: string | null
}

export interface Release {
  id: number
  release_no: string
  project_id: number
  project_name: string
  project_type: string
  environment_id: number
  environment_name: string
  version: string
  branch: string
  strategy: string
  notes: string
  status: string
  current_stage: number
  created_by: string
  created_at: string
  started_at: string | null
  finished_at: string | null
  steps: ReleaseStep[]
  logs: ReleaseLog[]
  deployments: ReleaseDeployment[]
}

export interface DashboardStats {
  today_releases: number
  success_rate: number
  average_duration_seconds: number
  online_targets: number
  total_targets: number
  pending_releases: number
  recent_releases: Release[]
}

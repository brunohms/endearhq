{{- define "worker.fullname" -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "worker.selectorLabels" -}}
app.kubernetes.io/name: {{ .Chart.Name }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "worker.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | quote }}
app.kubernetes.io/version: {{ .Values.image.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{ include "worker.selectorLabels" . }}
{{- end -}}

{{- define "worker.databaseUrl" -}}
postgres://{{ .Values.postgres.username }}:{{ .Values.postgres.password }}@{{ .Values.postgres.host }}:{{ .Values.postgres.port }}/{{ .Values.postgres.database }}
{{- end -}}

{{- define "worker.nodeOptions" -}}
{{- if .Values.otel.endpoint -}}
--experimental-loader=@opentelemetry/instrumentation/hook.mjs --import @app/telemetry/register {{ .Values.nodeOptions }}
{{- else -}}
{{ .Values.nodeOptions }}
{{- end -}}
{{- end -}}

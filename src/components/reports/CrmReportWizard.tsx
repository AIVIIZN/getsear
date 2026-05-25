"use client"

import * as React from "react"
import {
  AlertCircle,
  BarChart3,
  Bot,
  CheckCircle2,
  Download,
  FileText,
  Filter,
  HelpCircle,
  LayoutDashboard,
  Link2,
  Megaphone,
  MousePointer2,
  Save,
  Sparkles,
} from "lucide-react"
import { Button } from "@/components/ui-v2/Button"
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from "@/components/ui-v2/Card"
import { Badge } from "@/components/ui-v2/data/Badge"
import { Skeleton } from "@/components/ui-v2/data/Skeleton"
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState"
import { Checkbox } from "@/components/ui-v2/inputs/Checkbox"
import { Select } from "@/components/ui-v2/inputs/Select"
import { Text } from "@/components/ui-v2/inputs/Text"
import { Textarea } from "@/components/ui-v2/inputs/Textarea"
import {
  buildCrmReportPreviewPayload,
  buildCrmReportWizardPayload,
  buildCrmAiReportDraft,
  buildCrmAiReportDraftGatewayPayload,
  buildCrmReportCanvasValues,
  campaignRoiWizardDefaults,
  crmReportCanvasBlocks,
  reportWizardSteps,
  type CrmReportAiDraft,
  type CrmReportWizardAction,
  type CrmReportCanvasBlockId,
  type CrmReportCanvasConnection,
  type CrmReportWizardDimension,
  type CrmReportWizardMetric,
  type CrmReportWizardValues,
  type CrmReportWizardVisualization,
} from "@/lib/crm/report-wizard"
import { cn } from "@/lib/utils"

type MetricDefinition = {
  metric_key: CrmReportWizardMetric
  display_name: string
  description: string
  formula: string
  value_type: string
  allowed_dimensions: CrmReportWizardDimension[]
}

type DimensionDefinition = {
  dimension_key: CrmReportWizardDimension
  display_name: string
  description: string
  allowed_metrics: CrmReportWizardMetric[]
}

type PreviewResponse = {
  data: {
    explanation: string
    data_quality_warnings: string[]
    metric_keys: CrmReportWizardMetric[]
    dimension_keys: CrmReportWizardDimension[]
  }
}

type AiGatewayResponse = {
  data: {
    output: {
      text: string
      confidence: number
      source_citations: string[]
      approval_required: boolean
    } | null
  }
}

type DashboardTemplate = {
  template_key: string
  name: string
  audience: "owner" | "manager" | "marketing" | "loyalty" | "data_quality"
  description: string
  widgets: Array<{
    widget_key: string
    title: string
    widget_type: "metric_card" | "trend" | "breakdown" | "table" | "alert_queue"
    metric_keys: CrmReportWizardMetric[]
    dimension_keys: CrmReportWizardDimension[]
    visualization: CrmReportWizardVisualization
    position: { x: number; y: number; w: number; h: number }
    demo_value: string
    insight: string
    filters?: Record<string, unknown>
  }>
}

type LoadState = "loading" | "ready" | "error"

const dataAreaOptions: Array<{ value: CrmReportWizardValues["dataArea"]; label: string }> = [
  { value: "campaigns", label: "Campaigns and attribution" },
  { value: "guests", label: "Guests and lifecycle" },
  { value: "loyalty", label: "Loyalty performance" },
  { value: "recovery", label: "Service recovery" },
  { value: "operations", label: "Restaurant operations" },
]

const visualizationOptions: Array<{ value: CrmReportWizardVisualization; label: string }> = [
  { value: "table", label: "Table" },
  { value: "bar", label: "Bar" },
  { value: "line", label: "Line" },
  { value: "scorecard", label: "Scorecard" },
  { value: "stacked_bar", label: "Stacked bar" },
  { value: "area", label: "Area" },
  { value: "pie", label: "Pie" },
  { value: "heatmap", label: "Heatmap" },
]

const actionOptions: Array<{ key: CrmReportWizardAction; label: string; helper: string }> = [
  { key: "dashboard_widget", label: "Prepare dashboard widget", helper: "Saved on the report for dashboard setup." },
  { key: "scheduled_email", label: "Schedule owner email", helper: "Persists an owner email schedule with the report." },
  { key: "csv_export", label: "Enable CSV export", helper: "Downloads the current wizard definition and explanation." },
  { key: "threshold_alert", label: "Attach threshold alert", helper: "Stores the alert rule for manager review." },
  { key: "segment_handoff", label: "Attach segment handoff", helper: "Marks filters ready for segment review." },
  { key: "campaign_handoff", label: "Attach campaign handoff", helper: "Marks ROI findings ready for campaign review." },
]

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const json = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(json.error ?? "Request failed")
  return json as T
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n")
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }))
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function fieldLabel(value: string) {
  return value.split("_").map((part) => part[0]?.toUpperCase() + part.slice(1)).join(" ")
}

export function CrmReportWizard() {
  const [values, setValues] = React.useState<CrmReportWizardValues>(campaignRoiWizardDefaults)
  const [metrics, setMetrics] = React.useState<MetricDefinition[]>([])
  const [dimensions, setDimensions] = React.useState<DimensionDefinition[]>([])
  const [state, setState] = React.useState<LoadState>("loading")
  const [preview, setPreview] = React.useState<PreviewResponse["data"] | null>(null)
  const [savedReportId, setSavedReportId] = React.useState<string | null>(null)
  const [savedDashboardId, setSavedDashboardId] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState<"preview" | "save" | "ai" | "dashboard" | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [dashboardTemplates, setDashboardTemplates] = React.useState<DashboardTemplate[]>([])
  const [selectedTemplateKey, setSelectedTemplateKey] = React.useState<string>("campaign_roi")
  const [canvasBlocks, setCanvasBlocks] = React.useState<CrmReportCanvasBlockId[]>(["campaigns", "orders"])
  const [canvasConnections, setCanvasConnections] = React.useState<CrmReportCanvasConnection[]>([
    { from: "campaigns", to: "orders" },
  ])
  const [draggingBlock, setDraggingBlock] = React.useState<CrmReportCanvasBlockId | null>(null)
  const [aiPrompt, setAiPrompt] = React.useState("Show campaign ROI by week and call out repeat visits.")
  const [aiDraft, setAiDraft] = React.useState<CrmReportAiDraft | null>(null)
  const [aiGatewayText, setAiGatewayText] = React.useState<string | null>(null)

  React.useEffect(() => {
    async function loadDefinitions() {
      setState("loading")
      try {
        const [metricJson, dimensionJson] = await Promise.all([
          fetchJson<{ data: MetricDefinition[] }>("/api/crm/metrics"),
          fetchJson<{ data: DimensionDefinition[] }>("/api/crm/dimensions"),
        ])
        setMetrics(metricJson.data)
        setDimensions(dimensionJson.data)
        fetchJson<{ templates: DashboardTemplate[] }>("/api/crm/reports/dashboards?include_templates=true")
          .then((json) => setDashboardTemplates(json.templates))
          .catch(() => setDashboardTemplates([]))
        setState("ready")
      } catch {
        setState("error")
      }
    }
    loadDefinitions()
  }, [])

  const compatibleDimensions = React.useMemo(() => {
    if (!values.metricKeys.length) return dimensions
    return dimensions.filter((dimension) =>
      values.metricKeys.every((metricKey) => dimension.allowed_metrics.includes(metricKey)),
    )
  }, [dimensions, values.metricKeys])

  function patch(next: Partial<CrmReportWizardValues>) {
    setValues((current) => ({ ...current, ...next }))
    setSavedReportId(null)
    setSavedDashboardId(null)
    setAiDraft(null)
  }

  function setValuesFromBuilder(next: CrmReportWizardValues) {
    setValues(next)
    setSavedReportId(null)
    setSavedDashboardId(null)
    setPreview(null)
  }

  function applyDashboardTemplate(template: DashboardTemplate) {
    const firstWidget = template.widgets[0]
    if (!firstWidget) return
    setSelectedTemplateKey(template.template_key)
    setValuesFromBuilder({
      ...values,
      question: `Build the ${template.name.toLowerCase()} dashboard for ${template.audience.replace("_", " ")} review.`,
      dataArea: template.audience === "loyalty" ? "loyalty" : template.audience === "marketing" ? "campaigns" : template.audience === "manager" ? "recovery" : "operations",
      name: template.name,
      description: template.description,
      metricKeys: firstWidget.metric_keys,
      dimensionKeys: firstWidget.dimension_keys,
      visualization: firstWidget.visualization,
      actions: Array.from(new Set([...values.actions, "dashboard_widget"])),
    })
  }

  function addCanvasBlock(blockId: CrmReportCanvasBlockId) {
    setCanvasBlocks((current) => current.includes(blockId) ? current : [...current, blockId])
  }

  function removeCanvasBlock(blockId: CrmReportCanvasBlockId) {
    setCanvasBlocks((current) => current.length <= 1 ? current : current.filter((id) => id !== blockId))
    setCanvasConnections((current) => current.filter((connection) => connection.from !== blockId && connection.to !== blockId))
  }

  function toggleCanvasConnection(from: CrmReportCanvasBlockId, to: CrmReportCanvasBlockId) {
    if (from === to) return
    setCanvasConnections((current) => {
      const exists = current.some((connection) => connection.from === from && connection.to === to)
      return exists ? current.filter((connection) => !(connection.from === from && connection.to === to)) : [...current, { from, to }]
    })
  }

  function applyCanvasReport() {
    setValuesFromBuilder(buildCrmReportCanvasValues(values, canvasBlocks, canvasConnections))
  }

  function toggleMetric(metricKey: CrmReportWizardMetric) {
    setValues((current) => {
      const metricKeys = current.metricKeys.includes(metricKey)
        ? current.metricKeys.filter((key) => key !== metricKey)
        : [...current.metricKeys, metricKey]
      const allowed = dimensions
        .filter((dimension) => metricKeys.every((key) => dimension.allowed_metrics.includes(key)))
        .map((dimension) => dimension.dimension_key)
      return {
        ...current,
        metricKeys,
        dimensionKeys: current.dimensionKeys.filter((key) => allowed.includes(key)),
      }
    })
    setSavedReportId(null)
  }

  function toggleDimension(dimensionKey: CrmReportWizardDimension) {
    const dimensionKeys = values.dimensionKeys.includes(dimensionKey)
      ? values.dimensionKeys.filter((key) => key !== dimensionKey)
      : [...values.dimensionKeys, dimensionKey]
    patch({ dimensionKeys })
  }

  function toggleAction(action: CrmReportWizardAction) {
    const actions = values.actions.includes(action)
      ? values.actions.filter((key) => key !== action)
      : [...values.actions, action]
    patch({ actions })
  }

  async function runPreview() {
    if (!values.metricKeys.length) return
    setBusy("preview")
    setError(null)
    try {
      const json = await fetchJson<PreviewResponse>("/api/crm/reports/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCrmReportPreviewPayload(values)),
      })
      setPreview(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report preview failed")
    } finally {
      setBusy(null)
    }
  }

  async function askAiForDraft() {
    if (!aiPrompt.trim()) return
    setBusy("ai")
    setError(null)
    setAiGatewayText(null)
    try {
      const json = await fetchJson<AiGatewayResponse>("/api/ai/crm-gateway", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCrmAiReportDraftGatewayPayload(aiPrompt, canvasBlocks, canvasConnections)),
      })
      const draft = buildCrmAiReportDraft(aiPrompt, values)
      setAiGatewayText(json.data.output?.text ?? null)
      setAiDraft({
        ...draft,
        sourceCitations: json.data.output?.source_citations?.length ? json.data.output.source_citations : draft.sourceCitations,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI report draft failed")
    } finally {
      setBusy(null)
    }
  }

  function approveAiDraft() {
    if (!aiDraft) return
    setValuesFromBuilder(aiDraft.values)
    setAiDraft(null)
  }

  async function saveReport() {
    if (!values.name.trim() || !values.metricKeys.length) return
    setBusy("save")
    setError(null)
    try {
      const json = await fetchJson<{ data: { id: string } }>("/api/crm/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildCrmReportWizardPayload(values)),
      })
      setSavedReportId(json.data.id)
      await runPreview()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Report save failed")
    } finally {
      setBusy(null)
    }
  }

  async function saveDashboardFromTemplate(template: DashboardTemplate) {
    setBusy("dashboard")
    setError(null)
    try {
      const json = await fetchJson<{ data: { id: string } }>("/api/crm/reports/dashboards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: template.name,
          description: template.description,
          audience: template.audience,
          template_key: template.template_key,
          layout: { source: "crm_dashboard_template", columns: 12 },
          widgets: template.widgets.map((widget) => ({
            widget_key: widget.widget_key,
            title: widget.title,
            widget_type: widget.widget_type,
            metric_keys: widget.metric_keys,
            dimension_keys: widget.dimension_keys,
            filters: widget.filters ?? {},
            visualization: widget.visualization,
            position: widget.position,
            settings: {
              demo_value: widget.demo_value,
              insight: widget.insight,
              template_key: template.template_key,
            },
          })),
          metadata: { seed_demo_data: true },
        }),
      })
      setSavedDashboardId(json.data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Dashboard save failed")
    } finally {
      setBusy(null)
    }
  }

  function exportCsv() {
    const payload = buildCrmReportWizardPayload(values)
    downloadCsv("crm-report-wizard.csv", [
      ["Field", "Value"],
      ["Report", payload.name],
      ["Question", values.question],
      ["Metrics", values.metricKeys.join("; ")],
      ["Breakdowns", values.dimensionKeys.join("; ")],
      ["Visualization", values.visualization],
      ["Explanation", preview?.explanation ?? "Preview not run yet"],
      ["Warnings", preview?.data_quality_warnings.join("; ") ?? ""],
    ])
  }

  if (state === "loading") {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] p-[var(--space-6)]">
        <div className="mx-auto grid max-w-[1440px] gap-[var(--space-4)] xl:grid-cols-[320px_1fr_360px]">
          <Skeleton className="h-[620px] rounded-[var(--radius-md)]" />
          <Skeleton className="h-[620px] rounded-[var(--radius-md)]" />
          <Skeleton className="h-[620px] rounded-[var(--radius-md)]" />
        </div>
      </main>
    )
  }

  if (state === "error") {
    return (
      <main className="min-h-screen bg-[var(--color-bg)] p-[var(--space-6)]">
        <EmptyState
          icon={AlertCircle}
          title="Report definitions could not load"
          description="The wizard needs the semantic metric layer before it can build a trusted report."
          action={{ label: "Try again", onClick: () => window.location.reload() }}
        />
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[var(--color-bg)] p-[var(--space-6)]">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-[var(--space-5)]">
        <section className="flex flex-col gap-[var(--space-4)] lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-[var(--space-2)] flex items-center gap-[var(--space-2)] text-[var(--color-text-muted)]">
              <Sparkles className="size-[18px]" />
              <span className="text-[var(--type-footnote-size)] font-[var(--weight-semibold)] uppercase tracking-[0.04em]">CRM report builder</span>
            </div>
            <h1 className="text-[var(--type-title-1-size)] font-[var(--weight-bold)] text-[var(--color-text)]">Guided report wizard</h1>
            <p className="mt-[var(--space-2)] max-w-[760px] text-[var(--type-body-size)] text-[var(--color-text-secondary)]">
              Turn an owner question into a validated semantic metric report with preview, explanation, schedule, export, and follow-up handoffs.
            </p>
          </div>
          <div className="flex flex-wrap gap-[var(--space-2)]">
            <Button variant="secondary" loading={busy === "preview"} disabled={!values.metricKeys.length} onClick={runPreview} leadingIcon={<HelpCircle />}>Preview and explain</Button>
            <Button loading={busy === "save"} disabled={!values.name.trim() || !values.metricKeys.length} onClick={saveReport} leadingIcon={<Save />}>Save report</Button>
            {values.actions.includes("csv_export") ? (
              <Button variant="secondary" onClick={exportCsv} leadingIcon={<Download />}>Export CSV</Button>
            ) : null}
          </div>
        </section>

        {error ? (
          <div className="rounded-[var(--radius-md)] border border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-[var(--space-4)] text-[var(--color-danger)]">
            {error}
          </div>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-[var(--space-2)]"><LayoutDashboard className="size-[18px]" /> Dashboard templates</CardTitle>
            <CardDescription>Load a role-specific CRM dashboard with semantic metric widgets and demo values.</CardDescription>
          </CardHeader>
          <CardBody className="gap-[var(--space-4)]">
            {dashboardTemplates.length ? (
              <div className="grid gap-[var(--space-3)] lg:grid-cols-4">
                {dashboardTemplates.slice(0, 8).map((template) => {
                  const selected = selectedTemplateKey === template.template_key
                  return (
                    <section
                      key={template.template_key}
                      className={cn(
                        "flex min-h-[210px] flex-col justify-between rounded-[var(--radius-md)] border p-[var(--space-4)]",
                        selected ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)] bg-[var(--color-surface)]",
                      )}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-[var(--space-2)]">
                          <h2 className="text-[var(--type-headline-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">{template.name}</h2>
                          <Badge>{fieldLabel(template.audience)}</Badge>
                        </div>
                        <p className="mt-[var(--space-2)] text-[var(--type-footnote-size)] text-[var(--color-text-muted)]">{template.description}</p>
                        <div className="mt-[var(--space-3)] grid gap-[var(--space-2)]">
                          {template.widgets.slice(0, 2).map((widget) => (
                            <div key={widget.widget_key} className="rounded-[var(--radius-sm)] bg-[var(--color-bg-muted)] p-[var(--space-2)]">
                              <div className="text-[var(--type-footnote-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">{widget.title}: {widget.demo_value}</div>
                              <div className="text-[var(--type-caption-1-size)] text-[var(--color-text-muted)]">{widget.insight}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="mt-[var(--space-4)] flex flex-wrap gap-[var(--space-2)]">
                        <Button variant="secondary" onClick={() => applyDashboardTemplate(template)}>Use template</Button>
                        <Button loading={busy === "dashboard" && selected} onClick={() => saveDashboardFromTemplate(template)} leadingIcon={<Save />}>Save dashboard</Button>
                      </div>
                    </section>
                  )
                })}
              </div>
            ) : (
              <EmptyState
                icon={LayoutDashboard}
                title="Dashboard templates could not load"
                description="The report builder still works, but dashboard seed templates are unavailable."
              />
            )}
            {savedDashboardId ? (
              <div className="rounded-[var(--radius-md)] border border-[var(--color-success)] bg-[var(--color-success-soft)] p-[var(--space-3)] text-[var(--color-success)]">
                Dashboard saved with template widgets. ID {savedDashboardId}
              </div>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-[var(--space-2)]"><MousePointer2 className="size-[18px]" /> Visual canvas and Ask AI</CardTitle>
            <CardDescription>Compose report sources visually, then let AI draft a semantic definition for approval.</CardDescription>
          </CardHeader>
          <CardBody className="gap-[var(--space-5)]">
            <div className="grid gap-[var(--space-4)] xl:grid-cols-[280px_1fr_360px]">
              <section className="space-y-[var(--space-3)]">
                <h2 className="text-[var(--type-headline-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">Data blocks</h2>
                <div className="grid gap-[var(--space-2)]">
                  {crmReportCanvasBlocks.map((block) => {
                    const active = canvasBlocks.includes(block.id)
                    return (
                      <button
                        key={block.id}
                        type="button"
                        draggable
                        onDragStart={() => setDraggingBlock(block.id)}
                        onDragEnd={() => setDraggingBlock(null)}
                        onClick={() => active ? removeCanvasBlock(block.id) : addCanvasBlock(block.id)}
                        className={cn(
                          "min-h-[76px] rounded-[var(--radius-md)] border p-[var(--space-3)] text-left transition-colors",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-focus)]",
                          active
                            ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]"
                            : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]",
                        )}
                      >
                        <div className="flex items-center justify-between gap-[var(--space-2)]">
                          <span className="font-[var(--weight-semibold)] text-[var(--color-text)]">{block.label}</span>
                          {active ? <CheckCircle2 className="size-[16px] text-[var(--color-primary)]" /> : null}
                        </div>
                        <div className="mt-[var(--space-1)] text-[var(--type-footnote-size)] text-[var(--color-text-muted)]">{block.description}</div>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section
                className="min-h-[360px] rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg-muted)] p-[var(--space-4)]"
                onDragOver={(event) => event.preventDefault()}
                onDrop={() => {
                  if (draggingBlock) addCanvasBlock(draggingBlock)
                  setDraggingBlock(null)
                }}
              >
                <div className="mb-[var(--space-4)] flex flex-wrap items-center justify-between gap-[var(--space-3)]">
                  <div>
                    <h2 className="text-[var(--type-headline-size)] font-[var(--weight-semibold)] text-[var(--color-text)]">Connected report map</h2>
                    <p className="text-[var(--type-footnote-size)] text-[var(--color-text-muted)]">{canvasConnections.length} active connection{canvasConnections.length === 1 ? "" : "s"}</p>
                  </div>
                  <Button variant="secondary" onClick={applyCanvasReport} leadingIcon={<Link2 />}>Build from canvas</Button>
                </div>

                <div className="grid gap-[var(--space-3)] md:grid-cols-2">
                  {canvasBlocks.map((blockId, index) => {
                    const block = crmReportCanvasBlocks.find((item) => item.id === blockId)
                    const nextBlock = canvasBlocks[index + 1]
                    const linkedToNext = nextBlock ? canvasConnections.some((connection) => connection.from === blockId && connection.to === nextBlock) : false
                    if (!block) return null
                    return (
                      <div key={block.id} className="relative rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)] shadow-[var(--shadow-sm)]">
                        <div className="flex items-start justify-between gap-[var(--space-3)]">
                          <div>
                            <div className="font-[var(--weight-semibold)] text-[var(--color-text)]">{block.label}</div>
                            <div className="mt-[var(--space-1)] text-[var(--type-footnote-size)] text-[var(--color-text-muted)]">{block.metrics.slice(0, 3).map(fieldLabel).join(", ")}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeCanvasBlock(block.id)}
                            className="min-h-[32px] rounded-[var(--radius-sm)] px-[var(--space-2)] text-[var(--type-footnote-size)] text-[var(--color-text-muted)] hover:bg-[var(--color-surface-hover)]"
                          >
                            Remove
                          </button>
                        </div>
                        {nextBlock ? (
                          <button
                            type="button"
                            onClick={() => toggleCanvasConnection(block.id, nextBlock)}
                            className={cn(
                              "mt-[var(--space-3)] flex min-h-[40px] w-full items-center justify-center gap-[var(--space-2)] rounded-[var(--radius-sm)] border text-[var(--type-subhead-size)] transition-colors",
                              linkedToNext
                                ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                                : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)]",
                            )}
                          >
                            <Link2 className="size-[16px]" /> {linkedToNext ? "Connected" : "Connect to next"}
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              </section>

              <section className="space-y-[var(--space-3)]">
                <Textarea label="Ask AI" rows={4} value={aiPrompt} onChange={(event) => setAiPrompt(event.target.value)} />
                <Button loading={busy === "ai"} disabled={!aiPrompt.trim()} onClick={askAiForDraft} leadingIcon={<Bot />}>Draft report</Button>
                {aiDraft ? (
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-[var(--space-4)]">
                    <div className="font-[var(--weight-semibold)] text-[var(--color-text)]">Approval required</div>
                    <p className="mt-[var(--space-2)] text-[var(--type-subhead-size)] text-[var(--color-text-secondary)]">{aiDraft.rationale}</p>
                    {aiGatewayText ? (
                      <p className="mt-[var(--space-2)] text-[var(--type-footnote-size)] text-[var(--color-text-muted)]">{aiGatewayText}</p>
                    ) : null}
                    <div className="mt-[var(--space-3)] flex flex-wrap gap-[var(--space-2)]">
                      {aiDraft.values.metricKeys.map((metric) => <Badge key={metric}>{fieldLabel(metric)}</Badge>)}
                      {aiDraft.values.dimensionKeys.map((dimension) => <Badge key={dimension}>{fieldLabel(dimension)}</Badge>)}
                    </div>
                    <Button className="mt-[var(--space-4)]" onClick={approveAiDraft} leadingIcon={<CheckCircle2 />}>Approve draft</Button>
                  </div>
                ) : (
                  <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-[var(--space-4)] text-[var(--type-subhead-size)] text-[var(--color-text-secondary)]">
                    AI drafts stay separate from the saved report until approved.
                  </div>
                )}
              </section>
            </div>
          </CardBody>
        </Card>

        <div className="grid gap-[var(--space-4)] xl:grid-cols-[320px_1fr_360px]">
          <Card className="order-3 xl:order-1">
            <CardHeader>
              <CardTitle>Wizard steps</CardTitle>
              <CardDescription>Each step writes into the same report definition.</CardDescription>
            </CardHeader>
            <CardBody>
              {reportWizardSteps.map((step, index) => (
                <div key={step} className="flex items-center gap-[var(--space-3)] rounded-[var(--radius-sm)] p-[var(--space-2)]">
                  <span className="flex size-[28px] items-center justify-center rounded-[var(--radius-circle)] bg-[var(--color-bg-muted)] text-[var(--type-footnote-size)] font-[var(--weight-semibold)] text-[var(--color-text-secondary)]">
                    {index + 1}
                  </span>
                  <span className="text-[var(--type-subhead-size)] font-[var(--weight-medium)] text-[var(--color-text)]">{step}</span>
                </div>
              ))}
              {savedReportId ? (
                <div className="mt-[var(--space-4)] rounded-[var(--radius-md)] border border-[var(--color-success)] bg-[var(--color-success-soft)] p-[var(--space-3)] text-[var(--color-success)]">
                  <div className="flex items-center gap-[var(--space-2)] font-[var(--weight-semibold)]">
                    <CheckCircle2 className="size-[18px]" /> Saved
                  </div>
                  <div className="mt-[var(--space-1)] text-[var(--type-footnote-size)]">Report ID {savedReportId}</div>
                </div>
              ) : null}
            </CardBody>
          </Card>

          <Card className="order-1 xl:order-2">
            <CardHeader>
              <CardTitle>Build the report</CardTitle>
              <CardDescription>Campaign ROI is preloaded so an owner can answer the most common revenue question quickly.</CardDescription>
            </CardHeader>
            <CardBody className="gap-[var(--space-5)]">
              <Textarea label="Owner question" rows={3} value={values.question} onChange={(event) => patch({ question: event.target.value })} />
              <div className="grid gap-[var(--space-4)] md:grid-cols-2">
                <Text label="Report name" value={values.name} onChange={(event) => patch({ name: event.target.value })} />
                <Select value={values.dataArea} onChange={(dataArea) => patch({ dataArea })} label="Data area" options={dataAreaOptions} />
              </div>
              <Textarea label="Description" rows={2} value={values.description} onChange={(event) => patch({ description: event.target.value })} />

              <section className="space-y-[var(--space-3)]">
                <div className="flex items-center gap-[var(--space-2)] text-[var(--color-text)]">
                  <BarChart3 className="size-[18px]" />
                  <h2 className="text-[var(--type-headline-size)] font-[var(--weight-semibold)]">Metrics</h2>
                </div>
                <div className="grid gap-[var(--space-2)] md:grid-cols-2">
                  {metrics.map((metric) => {
                    const selected = values.metricKeys.includes(metric.metric_key)
                    return (
                      <button
                        key={metric.metric_key}
                        type="button"
                        onClick={() => toggleMetric(metric.metric_key)}
                        className={cn(
                          "min-h-[88px] rounded-[var(--radius-md)] border p-[var(--space-3)] text-left transition-colors",
                          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-focus)]",
                          selected ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)]" : "border-[var(--color-border)] bg-[var(--color-surface)] hover:bg-[var(--color-surface-hover)]",
                        )}
                      >
                        <div className="font-[var(--weight-semibold)] text-[var(--color-text)]">{metric.display_name}</div>
                        <div className="mt-[var(--space-1)] text-[var(--type-footnote-size)] text-[var(--color-text-muted)]">{metric.description}</div>
                      </button>
                    )
                  })}
                </div>
              </section>

              <section className="space-y-[var(--space-3)]">
                <div className="flex items-center gap-[var(--space-2)] text-[var(--color-text)]">
                  <Filter className="size-[18px]" />
                  <h2 className="text-[var(--type-headline-size)] font-[var(--weight-semibold)]">Breakdown and filters</h2>
                </div>
                <div className="flex flex-wrap gap-[var(--space-2)]">
                  {compatibleDimensions.map((dimension) => (
                    <button
                      key={dimension.dimension_key}
                      type="button"
                      onClick={() => toggleDimension(dimension.dimension_key)}
                      className={cn(
                        "min-h-[40px] rounded-[var(--radius-sm)] border px-[var(--space-3)] text-[var(--type-subhead-size)] transition-colors",
                        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-border-focus)]",
                        values.dimensionKeys.includes(dimension.dimension_key)
                          ? "border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] text-[var(--color-text)] hover:bg-[var(--color-surface-hover)]",
                      )}
                    >
                      {dimension.display_name}
                    </button>
                  ))}
                </div>
                <div className="grid gap-[var(--space-4)] md:grid-cols-2">
                  <Select
                    value={values.datePreset}
                    onChange={(datePreset) => patch({ datePreset })}
                    label="Date range"
                    options={[
                      { value: "last_7_days", label: "Last 7 days" },
                      { value: "last_30_days", label: "Last 30 days" },
                      { value: "last_90_days", label: "Last 90 days" },
                      { value: "quarter_to_date", label: "Quarter to date" },
                    ]}
                  />
                  <Text label="Attribution window" type="number" min={1} max={90} value={values.attributionWindowDays} onChange={(event) => patch({ attributionWindowDays: Number(event.target.value) })} />
                  <Text label="Minimum attributed revenue" type="number" min={0} value={values.minimumAttributedRevenue} onChange={(event) => patch({ minimumAttributedRevenue: Number(event.target.value) })} />
                  <Select value={values.visualization} onChange={(visualization) => patch({ visualization })} label="Visualization" options={visualizationOptions} />
                </div>
                <Checkbox checked={values.includeBaselineGuests} onChange={(event) => patch({ includeBaselineGuests: event.target.checked })} label="Include baseline guests" helper="Default is off so campaign ROI excludes guests not influenced by the campaign." />
              </section>
            </CardBody>
          </Card>

          <div className="order-2 flex flex-col gap-[var(--space-4)] xl:order-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-[var(--space-2)]"><FileText className="size-[18px]" /> Preview and explain</CardTitle>
                <CardDescription>The preview calls the report API and returns metric warnings before save.</CardDescription>
              </CardHeader>
              <CardBody>
                {preview ? (
                  <div className="space-y-[var(--space-3)]">
                    <p className="text-[var(--type-subhead-size)] text-[var(--color-text-secondary)]">{preview.explanation}</p>
                    <div className="flex flex-wrap gap-[var(--space-2)]">
                      {preview.metric_keys.map((metric) => <Badge key={metric}>{fieldLabel(metric)}</Badge>)}
                      {preview.dimension_keys.map((dimension) => <Badge key={dimension}>{fieldLabel(dimension)}</Badge>)}
                    </div>
                    {preview.data_quality_warnings.length ? (
                      <div className="rounded-[var(--radius-md)] border border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-[var(--space-3)] text-[var(--color-warning)]">
                        {preview.data_quality_warnings.join(" ")}
                      </div>
                    ) : (
                      <div className="rounded-[var(--radius-md)] border border-[var(--color-success)] bg-[var(--color-success-soft)] p-[var(--space-3)] text-[var(--color-success)]">
                        No data quality warnings for this metric mix.
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState icon={HelpCircle} title="No preview yet" description="Run preview to see the metric explanation and possible data issues." action={{ label: "Preview report", onClick: runPreview }} />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-[var(--space-2)]"><LayoutDashboard className="size-[18px]" /> Actions</CardTitle>
                <CardDescription>Actions are persisted with the saved report for downstream dashboard, alert, segment, and campaign workflows.</CardDescription>
              </CardHeader>
              <CardBody>
                {actionOptions.map((action) => (
                  <Checkbox
                    key={action.key}
                    checked={values.actions.includes(action.key)}
                    onChange={() => toggleAction(action.key)}
                    label={action.label}
                    helper={action.helper}
                  />
                ))}
                {values.actions.includes("scheduled_email") ? (
                  <Select
                    value={values.scheduleFrequency}
                    onChange={(scheduleFrequency) => patch({ scheduleFrequency })}
                    label="Schedule frequency"
                    options={[
                      { value: "daily", label: "Daily" },
                      { value: "weekly", label: "Weekly" },
                      { value: "monthly", label: "Monthly" },
                      { value: "none", label: "None" },
                    ]}
                  />
                ) : null}
                {values.actions.includes("threshold_alert") ? (
                  <Text label="Alert threshold" type="number" min={0} value={values.alertThreshold} onChange={(event) => patch({ alertThreshold: Number(event.target.value) })} leadingIcon={<Megaphone className="size-[16px]" />} />
                ) : null}
              </CardBody>
            </Card>
          </div>
        </div>
      </div>
    </main>
  )
}

"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Shield,
  ChevronDown,
  ChevronRight,
  Save,
  Users,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui-v2/Card";
import { Button } from "@/components/ui-v2/Button";
import { Checkbox } from "@/components/ui-v2/inputs/Checkbox";
import { Skeleton } from "@/components/ui-v2/data/Skeleton";
import { Badge } from "@/components/ui-v2/data/Badge";
import { EmptyState } from "@/components/ui-v2/feedback/EmptyState";
import { cn } from "@/lib/utils";

interface Permission {
  id: string;
  name: string;
  description: string | null;
  category: string;
}

interface RoleData {
  value: string;
  label: string;
  permission_ids: string[];
  permission_count: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  pos: "Point of Sale",
  orders: "Orders",
  menu: "Menu Management",
  staff: "Staff Management",
  reports: "Reports",
  settings: "Settings",
  admin: "Administration",
  customers: "Customers",
  payments: "Payments",
  tables: "Tables",
  kds: "Kitchen Display",
};

export default function RolesPage() {
  const [roles, setRoles] = useState<RoleData[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [editedPermissions, setEditedPermissions] = useState<Record<string, Set<string>>>({});
  const [savingRole, setSavingRole] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/roles");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setRoles(json.data.roles ?? []);
      setPermissions(json.data.permissions ?? []);

      const edited: Record<string, Set<string>> = {};
      for (const role of json.data.roles ?? []) {
        edited[role.value] = new Set(role.permission_ids);
      }
      setEditedPermissions(edited);
    } catch {
      toast.error("Failed to load roles and permissions");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const permissionsByCategory = permissions.reduce<Record<string, Permission[]>>(
    (acc, perm) => {
      const cat = perm.category || "other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(perm);
      return acc;
    },
    {},
  );

  const categories = Object.keys(permissionsByCategory).sort();

  function togglePermission(role: string, permId: string) {
    setEditedPermissions((prev) => {
      const next = { ...prev };
      const set = new Set(prev[role] ?? []);
      if (set.has(permId)) {
        set.delete(permId);
      } else {
        set.add(permId);
      }
      next[role] = set;
      return next;
    });
  }

  function toggleCategory(role: string, category: string, checked: boolean) {
    const categoryPerms = permissionsByCategory[category] ?? [];
    setEditedPermissions((prev) => {
      const next = { ...prev };
      const set = new Set(prev[role] ?? []);
      for (const perm of categoryPerms) {
        if (checked) {
          set.add(perm.id);
        } else {
          set.delete(perm.id);
        }
      }
      next[role] = set;
      return next;
    });
  }

  async function handleSave(role: string) {
    setSavingRole(role);
    try {
      const permIds = Array.from(editedPermissions[role] ?? []);
      const res = await fetch(`/api/settings/roles/${role}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permission_ids: permIds }),
      });
      if (!res.ok) throw new Error("Failed to save");
      toast.success(`Permissions updated for ${role}`);
      fetchRoles();
    } catch {
      toast.error("Failed to save role permissions");
    } finally {
      setSavingRole(null);
    }
  }

  function hasChanges(role: string): boolean {
    const original = roles.find((r) => r.value === role);
    if (!original) return false;
    const edited = editedPermissions[role];
    if (!edited) return false;
    const originalSet = new Set(original.permission_ids);
    if (originalSet.size !== edited.size) return true;
    for (const id of edited) {
      if (!originalSet.has(id)) return true;
    }
    return false;
  }

  if (loading) {
    return <RolesSkeleton />;
  }

  if (roles.length === 0) {
    return (
      <EmptyState
        icon={Shield}
        title="No roles configured"
        description="Roles and permissions will appear here once configured."
      />
    );
  }

  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div>
        <h2 className="text-[length:var(--type-title-2-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
          Roles & Permissions
        </h2>
        <p className="mt-[var(--space-1)] text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
          Configure what each role can access. Click a role to edit its permissions.
        </p>
      </div>

      <div className="flex flex-col gap-[var(--space-3)]">
        {roles.map((role) => {
          const isExpanded = expandedRole === role.value;
          const rolePermSet = editedPermissions[role.value] ?? new Set();
          const changed = hasChanges(role.value);

          return (
            <Card key={role.value} variant="flat" padding="default" className="gap-0 p-0 overflow-hidden">
              {/* Role header — clickable */}
              <button
                type="button"
                className={cn(
                  "btn-press touch-target flex w-full items-center justify-between p-[var(--space-4)] text-left",
                  "transition-colors duration-[var(--duration-quick)] ease-[var(--ease-out)]",
                  "hover:bg-[color:var(--color-surface-hover)]",
                  "focus-visible:outline-2 focus-visible:outline-[color:var(--color-border-focus)] focus-visible:outline-offset-2",
                )}
                onClick={() => setExpandedRole(isExpanded ? null : role.value)}
              >
                <div className="flex items-center gap-[var(--space-3)]">
                  <div className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-md)] bg-[color:var(--color-sidebar-active)]">
                    <Users className="h-4 w-4 text-[color:var(--color-primary)]" />
                  </div>
                  <div>
                    <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] text-[color:var(--color-text)]">
                      {role.label}
                    </p>
                    <p className="text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                      {rolePermSet.size} permission{rolePermSet.size !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-[var(--space-3)]">
                  {changed && <Badge variant="primary">Unsaved</Badge>}
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-[color:var(--color-text-muted)]" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-[color:var(--color-text-muted)]" />
                  )}
                </div>
              </button>

              {isExpanded && (
                <>
                  <div className="border-t border-[color:var(--color-border)]" />
                  <CardBody className="p-[var(--space-5)]">
                    {permissions.length === 0 ? (
                      <p className="py-[var(--space-4)] text-center text-[length:var(--type-subhead-size)] text-[color:var(--color-text-muted)]">
                        No permissions defined in the system yet.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-[var(--space-6)]">
                        {categories.map((category) => {
                          const catPerms = permissionsByCategory[category];
                          const allChecked = catPerms.every((p) => rolePermSet.has(p.id));
                          const someChecked =
                            !allChecked && catPerms.some((p) => rolePermSet.has(p.id));

                          return (
                            <div key={category}>
                              <div className="mb-[var(--space-3)] flex items-center gap-[var(--space-2)]">
                                <Checkbox
                                  checked={allChecked}
                                  indeterminate={someChecked}
                                  onChange={(e) =>
                                    toggleCategory(role.value, category, e.target.checked)
                                  }
                                />
                                <span className="text-[length:var(--type-subhead-size)] font-[var(--weight-semibold)] capitalize text-[color:var(--color-text)]">
                                  {CATEGORY_LABELS[category] ?? category}
                                </span>
                                <Badge variant="default" size="sm" className="ml-[var(--space-1)]">
                                  {catPerms.filter((p) => rolePermSet.has(p.id)).length}/
                                  {catPerms.length}
                                </Badge>
                              </div>
                              <div className="ml-[var(--space-6)] grid gap-[var(--space-2)] sm:grid-cols-2 lg:grid-cols-3">
                                {catPerms.map((perm) => (
                                  <label
                                    key={perm.id}
                                    className={cn(
                                      "btn-press touch-target flex cursor-pointer items-start gap-[var(--space-2)]",
                                      "rounded-[var(--radius-md)] border p-[var(--space-3)]",
                                      "transition-colors duration-[var(--duration-quick)] ease-[var(--ease-out)]",
                                      rolePermSet.has(perm.id)
                                        ? "border-[color:var(--color-primary)]/30 bg-[color:var(--color-sidebar-active)]"
                                        : "border-[color:var(--color-border)] hover:border-[color:var(--color-border-strong)] hover:bg-[color:var(--color-surface-hover)]",
                                    )}
                                  >
                                    <Checkbox
                                      checked={rolePermSet.has(perm.id)}
                                      onChange={() => togglePermission(role.value, perm.id)}
                                      fieldClassName="mt-[2px]"
                                    />
                                    <div>
                                      <p className="text-[length:var(--type-subhead-size)] font-[var(--weight-medium)] leading-tight text-[color:var(--color-text)]">
                                        {perm.name.replace(/_/g, " ")}
                                      </p>
                                      {perm.description && (
                                        <p className="mt-[2px] text-[length:var(--type-footnote-size)] text-[color:var(--color-text-muted)]">
                                          {perm.description}
                                        </p>
                                      )}
                                    </div>
                                  </label>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {changed && (
                      <div className="mt-[var(--space-6)] flex justify-end">
                        <Button
                          onClick={() => handleSave(role.value)}
                          loading={savingRole === role.value}
                          size="lg"
                          leadingIcon={<Save className="h-4 w-4" />}
                        >
                          Save Permissions
                        </Button>
                      </div>
                    )}
                  </CardBody>
                </>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function RolesSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--space-6)]">
      <div>
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-[var(--space-2)] h-4 w-72" />
      </div>
      <div className="flex flex-col gap-[var(--space-3)]">
        <Skeleton variant="card" className="h-16" />
        <Skeleton variant="card" className="h-16" />
        <Skeleton variant="card" className="h-16" />
      </div>
    </div>
  );
}

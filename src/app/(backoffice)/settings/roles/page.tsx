"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Shield,
  ChevronDown,
  ChevronRight,
  Loader2,
  Save,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/shared/EmptyState";
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

// Permission categories with labels
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

const CATEGORY_ICONS: Record<string, string> = {
  pos: "terminal",
  orders: "receipt",
  menu: "book",
  staff: "users",
  reports: "chart",
  settings: "cog",
  admin: "shield",
  customers: "user",
  payments: "credit-card",
  tables: "layout",
  kds: "monitor",
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

      // Initialize edited permissions from server state
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

  // Group permissions by category
  const permissionsByCategory = permissions.reduce<Record<string, Permission[]>>(
    (acc, perm) => {
      const cat = perm.category || "other";
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(perm);
      return acc;
    },
    {}
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
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Roles & Permissions</h2>
        <p className="text-sm text-muted-foreground">
          Configure what each role can access. Click a role to edit its permissions.
        </p>
      </div>

      <div className="space-y-3">
        {roles.map((role) => {
          const isExpanded = expandedRole === role.value;
          const rolePermSet = editedPermissions[role.value] ?? new Set();
          const changed = hasChanges(role.value);

          return (
            <Card key={role.value} className="shadow-warm-sm overflow-hidden">
              {/* Role header — clickable */}
              <button
                type="button"
                className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/30 touch-target"
                onClick={() => setExpandedRole(isExpanded ? null : role.value)}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent">
                    <Users className="h-4 w-4 text-accent-foreground" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{role.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {rolePermSet.size} permission{rolePermSet.size !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {changed && (
                    <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                      Unsaved
                    </Badge>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </button>

              {/* Expanded permissions */}
              {isExpanded && (
                <>
                  <Separator />
                  <CardContent className="pt-4">
                    {permissions.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4 text-center">
                        No permissions defined in the system yet.
                      </p>
                    ) : (
                      <div className="space-y-6">
                        {categories.map((category) => {
                          const catPerms = permissionsByCategory[category];
                          const allChecked = catPerms.every((p) =>
                            rolePermSet.has(p.id)
                          );
                          const someChecked =
                            !allChecked &&
                            catPerms.some((p) => rolePermSet.has(p.id));

                          return (
                            <div key={category}>
                              <div className="mb-3 flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={allChecked}
                                  ref={(el) => {
                                    if (el) el.indeterminate = someChecked;
                                  }}
                                  onChange={(e) =>
                                    toggleCategory(
                                      role.value,
                                      category,
                                      e.target.checked
                                    )
                                  }
                                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                />
                                <span className="text-sm font-semibold capitalize text-foreground">
                                  {CATEGORY_LABELS[category] ?? category}
                                </span>
                                <Badge variant="outline" className="text-xs ml-1">
                                  {catPerms.filter((p) => rolePermSet.has(p.id)).length}/
                                  {catPerms.length}
                                </Badge>
                              </div>
                              <div className="ml-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                {catPerms.map((perm) => (
                                  <label
                                    key={perm.id}
                                    className={cn(
                                      "flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 transition-colors touch-target",
                                      rolePermSet.has(perm.id)
                                        ? "border-primary/30 bg-accent/50"
                                        : "border-border hover:border-border-hover hover:bg-muted/30"
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={rolePermSet.has(perm.id)}
                                      onChange={() =>
                                        togglePermission(role.value, perm.id)
                                      }
                                      className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                                    />
                                    <div>
                                      <p className="text-sm font-medium text-foreground leading-tight">
                                        {perm.name.replace(/_/g, " ")}
                                      </p>
                                      {perm.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
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

                    {/* Save button */}
                    {changed && (
                      <div className="mt-6 flex justify-end">
                        <Button
                          onClick={() => handleSave(role.value)}
                          disabled={savingRole === role.value}
                          className="h-11 gap-2 btn-press touch-target"
                        >
                          {savingRole === role.value ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
                          Save Permissions
                        </Button>
                      </div>
                    )}
                  </CardContent>
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
    <div className="space-y-6">
      <div>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-72 mt-2" />
      </div>
      <div className="space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="shadow-warm-sm">
            <div className="flex items-center gap-3 p-4">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16 mt-1" />
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

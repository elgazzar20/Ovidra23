import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  Headphones,
  DollarSign,
  Code,
  Sliders,
  Search,
  UserPlus,
  Plus,
  Trash2,
  Check,
  X,
  Mail,
  RefreshCw,
  Sparkles,
  SlidersHorizontal,
  Info,
} from "lucide-react";
import { cn } from "../../utils/cn";
import { db as firestoreDb, FIREBASE_ENABLED } from "../../lib/firebase";
import { collection, doc, getDocs, setDoc, deleteDoc, updateDoc } from "firebase/firestore";
import { logAdminAction } from "../../lib/superadmin";

// Permissions type declarations
export interface PermissionItem {
  key: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
}

export interface PermissionGroup {
  categoryAr: string;
  categoryEn: string;
  permissions: PermissionItem[];
}

export interface RbacRole {
  id: string; // lowercase e.g., 'super_admin', 'support', 'finance', 'developer', 'moderator', 'custom_...'
  nameAr: string;
  nameEn: string;
  isCustom: boolean;
  icon: string; // e.g., 'shield', 'headphones', 'dollar', 'code', 'moderator', 'custom'
  permissions: string[]; // List of permission keys (e.g., 'page:bi')
  createdAt: number;
}

export interface RbacStaff {
  id: string;
  name: string;
  email: string;
  roleId: string;
  status: "active" | "suspended";
  createdAt: number;
}

// 1. Definition of all permissions: Pages, Actions, Features
const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    categoryAr: "الوصول لصفحات لوحة التحكم (Pages)",
    categoryEn: "Access Pages",
    permissions: [
      {
        key: "page:bi",
        nameAr: "تحليلات الأعمال (BI Dashboard)",
        nameEn: "Business Intelligence",
        descriptionAr: "الوصول لعرض تحليلات الأعمال، والرسوم البيانية والإيرادات الإجمالية.",
        descriptionEn: "View BI metrics, financial and enrollment growth charts.",
      },
      {
        key: "page:overview",
        nameAr: "صفحة نظرة عامة",
        nameEn: "Overview Page",
        descriptionAr: "عرض الإحصائيات السريعة للسناتر والمشتركين والعمليات الأخيرة.",
        descriptionEn: "Access dashboard general overview and instant stats cards.",
      },
      {
        key: "page:centers",
        nameAr: "إدارة السناتر والمستخدمين",
        nameEn: "Centers & Users Management",
        descriptionAr: "الوصول لجدول السناتر وتفاصيلهم وعرض مالكي السناتر والطلاب.",
        descriptionEn: "Access centers list, view owners details, and search accounts.",
      },
      {
        key: "page:control",
        nameAr: "الاشتراكات وباقات السناتر",
        nameEn: "Subscriptions & Features",
        descriptionAr: "الوصول لمركز التحكم بالاشتراكات وتفعيلها أو إيقافها وإرسال الفواتير.",
        descriptionEn: "Access subscriptions, adjust plans, issue invoices, and record payments.",
      },
      {
        key: "page:testimonials",
        nameAr: "إدارة التقييمات وآراء العملاء",
        nameEn: "Testimonials Panel",
        descriptionAr: "الوصول لاعتماد، حذف، أو تعديل آراء العملاء المعروضة على الصفحة الرئيسية.",
        descriptionEn: "Approve, delete, or re-order platform homepage testimonials.",
      },
      {
        key: "page:rbac",
        nameAr: "إدارة الصلاحيات والأدوار (RBAC)",
        nameEn: "RBAC & Role Management",
        descriptionAr: "إدارة وتعديل مصفوفة الصلاحيات، إنشاء أدوار مخصصة وتعيين الموظفين.",
        descriptionEn: "Manage roles permissions matrix, create custom roles, and assign staff.",
      },
      {
        key: "page:audit",
        nameAr: "سجلات النظام والعمليات (Audit Logs)",
        nameEn: "Platform Audit Logs",
        descriptionAr: "عرض السجلات والعمليات التفصيلية لكل ما قام به المسؤولون في المنصة.",
        descriptionEn: "Monitor security operations and actions performed by platform staff.",
      },
    ],
  },
  {
    categoryAr: "العمليات والإجراءات الحساسة (Actions)",
    categoryEn: "System Actions",
    permissions: [
      {
        key: "action:toggle_status",
        nameAr: "تجميد وتنشيط الحسابات",
        nameEn: "Suspend / Reactivate Accounts",
        descriptionAr: "إيقاف سنتر أو تجميده أو إعادة تفعيله والتحكم بحالته العامة.",
        descriptionEn: "Temporarily suspend or reactivate educational centers.",
      },
      {
        key: "action:delete_center",
        nameAr: "حذف سجل سنتر نهائياً",
        nameEn: "Delete Center Record",
        descriptionAr: "عملية حساسة جداً لحذف سنتر وملفاته بالكامل من النظام.",
        descriptionEn: "Permanently delete a center and purge its database records.",
      },
      {
        key: "action:extend_subscription",
        nameAr: "تمديد وتجديد الاشتراكات مانيوال",
        nameEn: "Manual Subscription Extension",
        descriptionAr: "إمكانية تمديد أو تجديد فترات الاشتراك للسناتر ومنحهم فترات سماح.",
        descriptionEn: "Manually extend/renew subscription end-dates for selected centers.",
      },
      {
        key: "action:cancel_subscription",
        nameAr: "إلغاء الاشتراكات النشطة",
        nameEn: "Cancel Subscriptions",
        descriptionAr: "إلغاء اشتراك سنتر نشط فوراً وتحويله للخطة المجانية.",
        descriptionEn: "Cancel active plan subscriptions and downgrade centers immediately.",
      },
      {
        key: "action:update_limits",
        nameAr: "تعديل حدود الخصائص الفردية",
        nameEn: "Override Center Limits",
        descriptionAr: "تعديل الحد الأقصى للطلاب/المعلمين المسموح به لسنتر محدد.",
        descriptionEn: "Override defaults (Max Students, Teachers) for specific centers.",
      },
      {
        key: "action:approve_testimonial",
        nameAr: "اعتماد وحذف التقييمات",
        nameEn: "Approve Testimonials",
        descriptionAr: "قبول أو رفض التقييمات الجديدة المقدمة من المستخدمين.",
        descriptionEn: "Toggle visibility or permanently reject pending testimonials.",
      },
      {
        key: "action:generate_license",
        nameAr: "توليد مفاتيح التراخيص",
        nameEn: "Generate License Keys",
        descriptionAr: "توليد أكواد ترخيص بريميوم جديدة للسناتر والمستخدمين لتفعيل الباقات.",
        descriptionEn: "Generate and configure premium keycodes for plan activations.",
      },
    ],
  },
  {
    categoryAr: "المميزات والخصائص الإضافية (Features)",
    categoryEn: "Advanced Features",
    permissions: [
      {
        key: "feature:export_reports",
        nameAr: "تصدير التقارير والإحصائيات",
        nameEn: "Export Reports",
        descriptionAr: "تحميل بيانات السناتر والإيرادات في ملفات Excel أو PDF.",
        descriptionEn: "Export business metrics, logs, and billing statements to spreadsheet.",
      },
      {
        key: "feature:send_messages",
        nameAr: "إرسال تنبيهات ورسائل مباشرة للسناتر",
        nameEn: "Direct Support Alerts",
        descriptionAr: "إرسال تنبيهات مخصصة تظهر داخل لوحة تحكم صاحب السنتر المستهدف.",
        descriptionEn: "Send system announcements or support notes directly inside center dash.",
      },
      {
        key: "feature:view_invoices",
        nameAr: "عرض وإصدار الفواتير المالية",
        nameEn: "View & Issue Invoices",
        descriptionAr: "عرض فواتير السناتر، تدوين المدفوعات وطباعة الإيصالات.",
        descriptionEn: "Access financial billing ledger, write payments, and print invoices.",
      },
      {
        key: "feature:access_dev",
        nameAr: "الوصول لأعلام المطورين ومفاتيح البيئة",
        nameEn: "Developer Mode & Flags",
        descriptionAr: "التحكم في أعلام الميزات النشطة (Vanguard Flags) لتفعيل الميزات التجريبية.",
        descriptionEn: "Toggle experimental development feature flags globally.",
      },
    ],
  },
];

// Initial default roles
const DEFAULT_ROLES: RbacRole[] = [
  {
    id: "super_admin",
    nameAr: "مدير النظام العام",
    nameEn: "Super Admin",
    isCustom: false,
    icon: "shield-check",
    permissions: [], // Dynamically treated as ALL permissions
    createdAt: 1720275600000,
  },
  {
    id: "support",
    nameAr: "الدعم الفني ومسؤول العملاء",
    nameEn: "Customer Support",
    isCustom: false,
    icon: "headphones",
    permissions: [
      "page:overview",
      "page:centers",
      "page:testimonials",
      "action:update_limits",
      "action:approve_testimonial",
      "feature:send_messages",
    ],
    createdAt: 1720275600000,
  },
  {
    id: "finance",
    nameAr: "المسؤول المالي والحسابات",
    nameEn: "Financial Officer",
    isCustom: false,
    icon: "dollar",
    permissions: [
      "page:overview",
      "page:control",
      "page:audit",
      "action:extend_subscription",
      "action:cancel_subscription",
      "feature:view_invoices",
      "feature:export_reports",
    ],
    createdAt: 1720275600000,
  },
  {
    id: "developer",
    nameAr: "المطور البرمجي للنظام",
    nameEn: "System Developer",
    isCustom: false,
    icon: "code",
    permissions: [
      "page:bi",
      "page:overview",
      "page:centers",
      "page:control",
      "page:audit",
      "action:generate_license",
      "feature:access_dev",
      "feature:export_reports",
    ],
    createdAt: 1720275600000,
  },
  {
    id: "moderator",
    nameAr: "مشرف المنصة والتقييمات",
    nameEn: "Platform Moderator",
    isCustom: false,
    icon: "moderator",
    permissions: [
      "page:overview",
      "page:testimonials",
      "action:toggle_status",
      "action:approve_testimonial",
      "feature:send_messages",
    ],
    createdAt: 1720275600000,
  },
];

// Initial default staff members
const DEFAULT_STAFF: RbacStaff[] = [
  {
    id: "mohamedelgazzar700@gmail.com",
    name: "م. محمد الغزّار",
    email: "mohamedelgazzar700@gmail.com",
    roleId: "super_admin",
    status: "active",
    createdAt: 1720275600000,
  },
  {
    id: "mohamedelgazzar748@gmail.com",
    name: "م. محمد الغزّار (القديم)",
    email: "mohamedelgazzar748@gmail.com",
    roleId: "super_admin",
    status: "active",
    createdAt: 1720275600000,
  },
  {
    id: "support@centerplus.com",
    name: "عبد الرحمن أحمد",
    email: "support@centerplus.com",
    roleId: "support",
    status: "active",
    createdAt: 1720276200000,
  },
  {
    id: "finance@centerplus.com",
    name: "نهال محمود (المالية)",
    email: "finance@centerplus.com",
    roleId: "finance",
    status: "active",
    createdAt: 1720276800000,
  },
  {
    id: "developer@centerplus.com",
    name: "م. كريم ياسر",
    email: "developer@centerplus.com",
    roleId: "developer",
    status: "active",
    createdAt: 1720277400000,
  },
  {
    id: "moderator@centerplus.com",
    name: "عمر خالد (الإشراف)",
    email: "moderator@centerplus.com",
    roleId: "moderator",
    status: "active",
    createdAt: 1720278000000,
  },
];

export function RbacManager({
  admin,
  onUpdate,
}: {
  admin: { uid: string; email: string };
  onUpdate: () => void;
}) {
  const [roles, setRoles] = useState<RbacRole[]>([]);
  const [staff, setStaff] = useState<RbacStaff[]>([]);
  const [loading, setLoading] = useState(true);

  // Search and view states
  const [subTab, setSubTab] = useState<"matrix" | "staff">("matrix");
  const [staffSearch, setStaffSearch] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Modal forms states
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleForm, setRoleForm] = useState({
    nameAr: "",
    nameEn: "",
    baseTemplate: "support",
    icon: "custom",
  });

  const [showStaffModal, setShowStaffModal] = useState(false);
  const [staffForm, setStaffForm] = useState({
    name: "",
    email: "",
    roleId: "support",
  });

  // Display Toast helper
  const triggerToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4000);
  };

  // Load initial data from Firestore or LocalStorage
  const loadRbacData = async () => {
    setLoading(true);
    try {
      let loadedRoles: RbacRole[] = [];
      let loadedStaff: RbacStaff[] = [];

      if (FIREBASE_ENABLED && firestoreDb) {
        // 1. Roles loading
        try {
          const rolesSnap = await getDocs(collection(firestoreDb, "platform_roles"));
          if (rolesSnap.empty) {
            // Seed defaults to Firestore
            for (const r of DEFAULT_ROLES) {
              await setDoc(doc(firestoreDb, "platform_roles", r.id), r);
            }
            loadedRoles = [...DEFAULT_ROLES];
          } else {
            loadedRoles = rolesSnap.docs.map((d) => d.data() as RbacRole);
          }
        } catch (e) {
          console.error("Firestore roles load failed, using local storage", e);
        }

        // 2. Staff loading
        try {
          const staffSnap = await getDocs(collection(firestoreDb, "platform_staff"));
          if (staffSnap.empty) {
            // Seed defaults to Firestore
            for (const s of DEFAULT_STAFF) {
              await setDoc(doc(firestoreDb, "platform_staff", s.id), s);
            }
            loadedStaff = [...DEFAULT_STAFF];
          } else {
            loadedStaff = staffSnap.docs.map((d) => d.data() as RbacStaff);
            // Ensure mohamedelgazzar700@gmail.com is seeded in Firestore staff list
            const hasNewAdmin = loadedStaff.some(s => s.id.toLowerCase() === "mohamedelgazzar700@gmail.com");
            if (!hasNewAdmin) {
              const newAdminDoc = DEFAULT_STAFF.find(s => s.id === "mohamedelgazzar700@gmail.com");
              if (newAdminDoc) {
                await setDoc(doc(firestoreDb, "platform_staff", newAdminDoc.id), newAdminDoc);
                loadedStaff.push(newAdminDoc);
              }
            }
          }
        } catch (e) {
          console.error("Firestore staff load failed", e);
        }
      }

      // If Firebase failed or empty, fallback to LocalStorage/Default
      if (loadedRoles.length === 0) {
        const localRoles = localStorage.getItem("platform_roles");
        if (localRoles) {
          loadedRoles = JSON.parse(localRoles);
        } else {
          loadedRoles = [...DEFAULT_ROLES];
          localStorage.setItem("platform_roles", JSON.stringify(DEFAULT_ROLES));
        }
      }

      if (loadedStaff.length === 0) {
        const localStaff = localStorage.getItem("platform_staff");
        if (localStaff) {
          loadedStaff = JSON.parse(localStaff);
        } else {
          loadedStaff = [...DEFAULT_STAFF];
          localStorage.setItem("platform_staff", JSON.stringify(DEFAULT_STAFF));
        }
      }

      // Sort roles to make sure super admin is first, then defaults, then custom
      const sortedRoles = [...loadedRoles].sort((a, b) => {
        if (a.id === "super_admin") return -1;
        if (b.id === "super_admin") return 1;
        if (a.isCustom && !b.isCustom) return 1;
        if (!a.isCustom && b.isCustom) return -1;
        return b.createdAt - a.createdAt;
      });

      setRoles(sortedRoles);
      setStaff(loadedStaff);
    } catch (error) {
      console.error("Critical error loading RBAC data", error);
      triggerToast("خطأ أثناء تحميل صلاحيات النظام", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRbacData();
  }, []);

  // Save current roles state to backend
  const saveRoleToDb = async (updatedRole: RbacRole) => {
    try {
      if (FIREBASE_ENABLED && firestoreDb) {
        await setDoc(doc(firestoreDb, "platform_roles", updatedRole.id), updatedRole);
      }
      // Sync local storage always for absolute safety
      const localRoles = localStorage.getItem("platform_roles");
      let list: RbacRole[] = localRoles ? JSON.parse(localRoles) : [];
      list = list.filter((r) => r.id !== updatedRole.id);
      list.push(updatedRole);
      localStorage.setItem("platform_roles", JSON.stringify(list));

      // Log to system audit logs
      await logAdminAction({
        adminUid: admin.uid,
        adminEmail: admin.email,
        action: "role:updated",
        targetType: "user",
        targetId: updatedRole.id,
        targetName: updatedRole.nameAr,
        newValue: `Permissions count: ${updatedRole.permissions.length}`,
      });

      onUpdate(); // triggers dashboard reload
    } catch (err) {
      console.error("Save role failed", err);
      triggerToast("فشل حفظ التعديلات سحابياً", "error");
    }
  };

  // Toggle a single permission cell
  const handleTogglePermission = async (roleId: string, permissionKey: string) => {
    if (roleId === "super_admin") {
      triggerToast("لا يمكن تعديل صلاحيات المدير العام للنظام لتفادي حظر الدخول!", "error");
      return;
    }

    const targetRole = roles.find((r) => r.id === roleId);
    if (!targetRole) return;

    const hasPerm = targetRole.permissions.includes(permissionKey);
    let updatedPermissions = [...targetRole.permissions];

    if (hasPerm) {
      updatedPermissions = updatedPermissions.filter((p) => p !== permissionKey);
    } else {
      updatedPermissions.push(permissionKey);
    }

    const updatedRole: RbacRole = {
      ...targetRole,
      permissions: updatedPermissions,
    };

    // Optimistic UI update
    setRoles((prev) => prev.map((r) => (r.id === roleId ? updatedRole : r)));
    triggerToast(`تم تحديث صلاحية لـ ${targetRole.nameAr} بنجاح`);

    await saveRoleToDb(updatedRole);
  };

  // Create a new custom role
  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleForm.nameAr.trim() || !roleForm.nameEn.trim()) {
      triggerToast("يرجى إدخال اسم الدور باللغتين العربية والإنجليزية", "error");
      return;
    }

    const templateRole = roles.find((r) => r.id === roleForm.baseTemplate);
    const initialPerms = templateRole ? [...templateRole.permissions] : [];

    const newRoleId = `custom_role_${Date.now()}`;
    const newRole: RbacRole = {
      id: newRoleId,
      nameAr: roleForm.nameAr.trim(),
      nameEn: roleForm.nameEn.trim(),
      isCustom: true,
      icon: roleForm.icon,
      permissions: initialPerms,
      createdAt: Date.now(),
    };

    setLoading(true);
    try {
      if (FIREBASE_ENABLED && firestoreDb) {
        try {
          await setDoc(doc(firestoreDb, "platform_roles", newRoleId), newRole);
        } catch (fbErr) {
          console.warn("Firestore error while saving role, using local storage:", fbErr);
        }
      }

      // Local storage update
      const localRoles = localStorage.getItem("platform_roles");
      const list: RbacRole[] = localRoles ? JSON.parse(localRoles) : [...DEFAULT_ROLES];
      list.push(newRole);
      localStorage.setItem("platform_roles", JSON.stringify(list));

      // Append state
      setRoles((prev) => [...prev, newRole]);
      setShowRoleModal(false);
      setRoleForm({ nameAr: "", nameEn: "", baseTemplate: "support", icon: "custom" });
      triggerToast(`تم إنشاء الدور المخصص "${newRole.nameAr}" بنجاح!`);

      // Log audit
      await logAdminAction({
        adminUid: admin.uid,
        adminEmail: admin.email,
        action: "role:created",
        targetType: "user",
        targetId: newRoleId,
        targetName: newRole.nameAr,
        newValue: `Base template: ${roleForm.baseTemplate}`,
      });

      onUpdate();
    } catch (err) {
      console.error(err);
      triggerToast("حدث خطأ أثناء إنشاء الدور المخصص", "error");
    } finally {
      setLoading(false);
    }
  };

  // Delete a custom role
  const handleDeleteRole = async (roleId: string, roleName: string) => {
    if (!window.confirm(`هل أنت متأكد من حذف الدور المخصص "${roleName}"؟ سيتم نقل الموظفين المعينين عليه إلى دور الدعم الفني.`)) {
      return;
    }

    setLoading(true);
    try {
      // 1. Delete from Firestore
      if (FIREBASE_ENABLED && firestoreDb) {
        try {
          await deleteDoc(doc(firestoreDb, "platform_roles", roleId));
        } catch (fbErr) {
          console.warn("Firestore error while deleting role, using local storage:", fbErr);
        }
      }

      // 2. Local storage updates
      const localRoles = localStorage.getItem("platform_roles");
      if (localRoles) {
        const list: RbacRole[] = JSON.parse(localRoles);
        const filtered = list.filter((r) => r.id !== roleId);
        localStorage.setItem("platform_roles", JSON.stringify(filtered));
      }

      // 3. Move affected staff to support
      const affectedStaff = staff.filter((s) => s.roleId === roleId);
      for (const s of affectedStaff) {
        const updatedStaff = { ...s, roleId: "support" };
        if (FIREBASE_ENABLED && firestoreDb) {
          try {
            await setDoc(doc(firestoreDb, "platform_staff", s.id), updatedStaff);
          } catch (fbErr) {
            console.warn("Firestore error while reassigning staff, using local storage:", fbErr);
          }
        }
      }

      const updatedStaffList = staff.map((s) => (s.roleId === roleId ? { ...s, roleId: "support" } : s));
      const localStaff = localStorage.getItem("platform_staff");
      if (localStaff) {
        const list: RbacStaff[] = JSON.parse(localStaff);
        const mapped = list.map((s) => (s.roleId === roleId ? { ...s, roleId: "support" } : s));
        localStorage.setItem("platform_staff", JSON.stringify(mapped));
      }

      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      setStaff(updatedStaffList);
      triggerToast(`تم حذف الدور "${roleName}" وتحويل موظفيه للدعم الفني.`);

      // Log audit
      await logAdminAction({
        adminUid: admin.uid,
        adminEmail: admin.email,
        action: "role:deleted",
        targetType: "user",
        targetId: roleId,
        targetName: roleName,
      });

      onUpdate();
    } catch (err) {
      console.error(err);
      triggerToast("حدث خطأ أثناء حذف الدور المخصص", "error");
    } finally {
      setLoading(false);
    }
  };

  // Assign staff to a new role
  const handleAssignRole = async (staffId: string, newRoleId: string) => {
    const targetStaff = staff.find((s) => s.id === staffId);
    if (!targetStaff) return;

    const oldRoleId = targetStaff.roleId;
    const updatedStaff: RbacStaff = {
      ...targetStaff,
      roleId: newRoleId,
    };

    // Optimistic UI
    setStaff((prev) => prev.map((s) => (s.id === staffId ? updatedStaff : s)));
    triggerToast(`تم تغيير دور ${targetStaff.name} بنجاح`);

    try {
      if (FIREBASE_ENABLED && firestoreDb) {
        try {
          await setDoc(doc(firestoreDb, "platform_staff", staffId), updatedStaff);
        } catch (fbErr) {
          console.warn("Firestore error while assigning role, using local storage:", fbErr);
        }
      }

      // Local storage
      const localStaff = localStorage.getItem("platform_staff");
      if (localStaff) {
        let list: RbacStaff[] = JSON.parse(localStaff);
        list = list.map((s) => (s.id === staffId ? updatedStaff : s));
        localStorage.setItem("platform_staff", JSON.stringify(list));
      }

      // Audit Log
      const roleName = roles.find((r) => r.id === newRoleId)?.nameAr || newRoleId;
      await logAdminAction({
        adminUid: admin.uid,
        adminEmail: admin.email,
        action: "staff:assigned",
        targetType: "user",
        targetId: staffId,
        targetName: targetStaff.name,
        previousValue: oldRoleId,
        newValue: roleName,
      });

      onUpdate();
    } catch (err) {
      console.error(err);
      triggerToast("فشل حفظ تغيير دور الموظف سحابياً", "error");
    }
  };

  // Toggle staff status (Active / Suspended)
  const handleToggleStaffStatus = async (staffId: string) => {
    const targetStaff = staff.find((s) => s.id === staffId);
    if (!targetStaff) return;

    if (targetStaff.email === admin.email) {
      triggerToast("لا يمكنك تجميد حسابك الشخصي الذي تستخدمه لتسجيل الدخول حالياً!", "error");
      return;
    }

    const nextStatus = targetStaff.status === "active" ? "suspended" : "active";
    const updatedStaff: RbacStaff = {
      ...targetStaff,
      status: nextStatus,
    };

    // Optimistic UI
    setStaff((prev) => prev.map((s) => (s.id === staffId ? updatedStaff : s)));
    triggerToast(`تم ${nextStatus === "active" ? "تنشيط" : "تجميد"} حساب الموظف ${targetStaff.name}`);

    try {
      if (FIREBASE_ENABLED && firestoreDb) {
        try {
          await updateDoc(doc(firestoreDb, "platform_staff", staffId), { status: nextStatus });
        } catch (fbErr) {
          console.warn("Firestore error while toggling staff status, using local storage:", fbErr);
        }
      }

      const localStaff = localStorage.getItem("platform_staff");
      if (localStaff) {
        let list: RbacStaff[] = JSON.parse(localStaff);
        list = list.map((s) => (s.id === staffId ? updatedStaff : s));
        localStorage.setItem("platform_staff", JSON.stringify(list));
      }

      // Audit Log
      await logAdminAction({
        adminUid: admin.uid,
        adminEmail: admin.email,
        action: nextStatus === "active" ? "staff:activated" : "staff:suspended",
        targetType: "user",
        targetId: staffId,
        targetName: targetStaff.name,
      });

      onUpdate();
    } catch (err) {
      console.error(err);
      triggerToast("حدث خطأ أثناء تحديث حالة الموظف", "error");
    }
  };

  // Add a new staff member
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!staffForm.name.trim() || !staffForm.email.trim()) {
      triggerToast("يرجى تعبئة كافة الحقول المطلوبة للموظف", "error");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(staffForm.email.trim())) {
      triggerToast("يرجى إدخال عنوان بريد إلكتروني صحيح", "error");
      return;
    }

    const newStaffId = staffForm.email.trim().toLowerCase();
    const newStaff: RbacStaff = {
      id: newStaffId,
      name: staffForm.name.trim(),
      email: staffForm.email.trim().toLowerCase(),
      roleId: staffForm.roleId,
      status: "active",
      createdAt: Date.now(),
    };

    setLoading(true);
    try {
      if (FIREBASE_ENABLED && firestoreDb) {
        try {
          await setDoc(doc(firestoreDb, "platform_staff", newStaffId), newStaff);
        } catch (fbErr) {
          console.warn("Firestore error while saving staff, using local storage:", fbErr);
        }
      }

      // Local storage
      const localStaff = localStorage.getItem("platform_staff");
      const list: RbacStaff[] = localStaff ? JSON.parse(localStaff) : [...DEFAULT_STAFF];
      list.push(newStaff);
      localStorage.setItem("platform_staff", JSON.stringify(list));

      setStaff((prev) => [...prev, newStaff]);
      setShowStaffModal(false);
      setStaffForm({ name: "", email: "", roleId: "support" });
      triggerToast(`تمت إضافة الموظف الجديد "${newStaff.name}" وتعيينه بنجاح.`);

      // Log audit
      await logAdminAction({
        adminUid: admin.uid,
        adminEmail: admin.email,
        action: "staff:created",
        targetType: "user",
        targetId: newStaffId,
        targetName: newStaff.name,
        newValue: newStaff.roleId,
      });

      onUpdate();
    } catch (err) {
      console.error(err);
      triggerToast("حدث خطأ أثناء إضافة حساب موظف جديد", "error");
    } finally {
      setLoading(false);
    }
  };

  // Delete a staff member
  const handleDeleteStaff = async (staffId: string, staffName: string) => {
    if (staff.find((s) => s.id === staffId)?.email === admin.email) {
      triggerToast("لا يمكنك حذف حسابك الشخصي النشط حالياً!", "error");
      return;
    }

    if (!window.confirm(`هل أنت متأكد من إلغاء حساب الموظف "${staffName}" نهائياً من المنصة؟`)) {
      return;
    }

    setLoading(true);
    try {
      if (FIREBASE_ENABLED && firestoreDb) {
        try {
          await deleteDoc(doc(firestoreDb, "platform_staff", staffId));
        } catch (fbErr) {
          console.warn("Firestore error while deleting staff, using local storage:", fbErr);
        }
      }

      const localStaff = localStorage.getItem("platform_staff");
      if (localStaff) {
        const list: RbacStaff[] = JSON.parse(localStaff);
        const filtered = list.filter((s) => s.id !== staffId);
        localStorage.setItem("platform_staff", JSON.stringify(filtered));
      }

      setStaff((prev) => prev.filter((s) => s.id !== staffId));
      triggerToast(`تم إلغاء حساب الموظف "${staffName}" بنجاح.`);

      // Log audit
      await logAdminAction({
        adminUid: admin.uid,
        adminEmail: admin.email,
        action: "staff:deleted",
        targetType: "user",
        targetId: staffId,
        targetName: staffName,
      });

      onUpdate();
    } catch (err) {
      console.error(err);
      triggerToast("حدث خطأ أثناء حذف حساب الموظف", "error");
    } finally {
      setLoading(false);
    }
  };

  // Filtered staff list based on search query
  const filteredStaff = useMemo(() => {
    return staff.filter(
      (s) =>
        s.name.toLowerCase().includes(staffSearch.toLowerCase()) ||
        s.email.toLowerCase().includes(staffSearch.toLowerCase()) ||
        (roles.find((r) => r.id === s.roleId)?.nameAr || "").toLowerCase().includes(staffSearch.toLowerCase())
    );
  }, [staff, staffSearch, roles]);

  // Helper to get role icon
  const getRoleIconComponent = (icon: string, className = "h-4 w-4") => {
    switch (icon) {
      case "shield-check":
        return <ShieldCheck className={cn(className, "text-emerald-500")} />;
      case "headphones":
        return <Headphones className={cn(className, "text-cyan-500")} />;
      case "dollar":
        return <DollarSign className={cn(className, "text-amber-500")} />;
      case "code":
        return <Code className={cn(className, "text-indigo-500")} />;
      case "moderator":
        return <ShieldAlert className={cn(className, "text-purple-500")} />;
      default:
        return <Sliders className={cn(className, "text-rose-500")} />;
    }
  };

  if (loading && roles.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-8 w-8 animate-spin text-rose-600" />
          <p className="mt-3 text-sm text-muted">جاري تحميل مصفوفة الصلاحيات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Toast Alert System */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className={cn(
              "fixed top-4 left-4 z-50 flex items-center gap-2.5 rounded-xl px-4 py-3 text-xs font-semibold shadow-xl border backdrop-blur-md",
              toast.type === "success"
                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                : toast.type === "error"
                ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                : "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
            )}
          >
            {toast.type === "success" ? (
              <Check className="h-4 w-4 text-emerald-500" />
            ) : toast.type === "error" ? (
              <X className="h-4 w-4 text-rose-500" />
            ) : (
              <Info className="h-4 w-4 text-blue-500" />
            )}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main RBAC Dashboard Header Info */}
      <div className="relative overflow-hidden rounded-2xl border border-line bg-surface p-4 sm:p-6 shadow-sm">
        <div className="absolute left-0 top-0 h-full w-1/3 bg-gradient-to-l from-transparent to-rose-500/5 pointer-events-none" />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600">
                <Shield className="h-4 w-4" />
              </span>
              <h2 className="text-base font-bold text-ink">إدارة الصلاحيات المتقدمة (RBAC)</h2>
            </div>
            <p className="text-xs text-muted max-w-xl leading-relaxed">
              تتيح لك هذه اللوحة التحكم الكامل بصلاحيات موظفي المنصة. يمكنك إنشاء أدوار مخصصة وتحديد إمكانية الوصول لكل صفحة وإجراء وميزة بشكل تفصيلي عبر مصفوفة الصلاحيات الاحترافية.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSubTab("matrix")}
              className={cn(
                "rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                subTab === "matrix"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/10"
                  : "bg-elevated/50 text-muted hover:bg-elevated hover:text-ink"
              )}
            >
              مصفوفة الصلاحيات (Matrix)
            </button>
            <button
              onClick={() => setSubTab("staff")}
              className={cn(
                "rounded-xl px-4 py-2 text-xs font-semibold transition-all",
                subTab === "staff"
                  ? "bg-rose-600 text-white shadow-md shadow-rose-600/10"
                  : "bg-elevated/50 text-muted hover:bg-elevated hover:text-ink"
              )}
            >
              موظفي المنصة ({staff.length})
            </button>
          </div>
        </div>
      </div>

      {/* MATRIX VIEW */}
      {subTab === "matrix" && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-surface/60 p-4 rounded-2xl border border-line">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-ink">مصفوفة الصلاحيات التفاعلية</h3>
              <p className="text-xs text-muted">اضغط على أي خلية قابلة للتعديل لتفعيل أو إلغاء الصلاحية فوراً للرول المحدد.</p>
            </div>
            <button
              onClick={() => setShowRoleModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 px-3.5 py-2 text-xs font-bold text-white transition hover:brightness-110 shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" /> إنشاء دور مخصص
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-start text-sm">
                <thead>
                  <tr className="border-b border-line bg-elevated/40 text-[11px] font-bold text-faint">
                    <th className="sticky right-0 z-10 bg-surface px-4 py-4 text-start font-bold min-w-[240px] text-ink">الصلاحيات والخصائص</th>
                    {roles.map((r) => (
                      <th key={r.id} className="px-3 py-4 text-center font-bold text-ink min-w-[120px]">
                        <div className="flex flex-col items-center justify-center gap-1.5">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-elevated/70">
                            {getRoleIconComponent(r.icon, "h-4.5 w-4.5")}
                          </div>
                          <div>
                            <p className="font-bold text-xs">{r.nameAr}</p>
                            <span className="text-[10px] text-faint block">{r.nameEn}</span>
                          </div>
                          {r.isCustom ? (
                            <button
                              onClick={() => handleDeleteRole(r.id, r.nameAr)}
                              title="حذف هذا الدور"
                              className="mt-1 rounded-md p-1 text-muted hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 transition"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          ) : r.id === "super_admin" ? (
                            <span className="mt-1 rounded bg-rose-500/10 px-1 py-0.5 text-[8px] font-bold text-rose-600">كاملة (قراءة فقط)</span>
                          ) : (
                            <span className="mt-1 rounded bg-elevated px-1 py-0.5 text-[8px] font-bold text-muted">افتراضي</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_GROUPS.map((group, groupIdx) => (
                    <tr key={groupIdx} className="border-b border-line">
                      <td colSpan={roles.length + 1} className="bg-elevated/20 px-4 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs font-extrabold text-rose-600 dark:text-rose-400">
                          <Sparkles className="h-3.5 w-3.5" />
                          {group.categoryAr}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {PERMISSION_GROUPS.flatMap((group) => group.permissions).map((perm, permIdx) => (
                    <tr key={perm.key} className={cn("border-b border-line/40 hover:bg-elevated/20 transition-colors", permIdx % 2 === 0 ? "bg-surface" : "bg-elevated/10")}>
                      <td className="sticky right-0 z-10 bg-surface/90 backdrop-blur-sm px-4 py-3 border-l border-line/40">
                        <div className="space-y-0.5">
                          <p className="font-semibold text-xs text-ink">{perm.nameAr}</p>
                          <p className="text-[10px] text-faint max-w-sm font-normal leading-relaxed">{perm.descriptionAr}</p>
                        </div>
                      </td>
                      {roles.map((r) => {
                        const isSuperAdmin = r.id === "super_admin";
                        const isAllowed = isSuperAdmin || r.permissions.includes(perm.key);
                        return (
                          <td key={r.id} className="px-3 py-3 text-center">
                            <button
                              disabled={isSuperAdmin}
                              onClick={() => handleTogglePermission(r.id, perm.key)}
                              className={cn(
                                "mx-auto flex h-6 w-6 items-center justify-center rounded-md transition-all shadow-sm border",
                                isAllowed
                                  ? isSuperAdmin
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 cursor-not-allowed"
                                    : "bg-emerald-500 border-emerald-500 text-white hover:bg-emerald-600 hover:border-emerald-600"
                                  : "bg-surface hover:bg-elevated border-line text-muted"
                              )}
                            >
                              {isAllowed ? (
                                <Check className="h-3.5 w-3.5 stroke-[3px]" />
                              ) : (
                                <X className="h-3 w-3 stroke-[2.5px] opacity-25" />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-1.5 border-t border-line bg-elevated/10 px-4 py-3 text-[11px] text-muted font-medium">
              <Info className="h-3.5 w-3.5 text-rose-500 shrink-0" />
              <span>ملاحظة أمنية: يتم حفظ وتطبيق الصلاحيات سحابياً ومحلياً فور النقر على المصفوفة. يسري التعديل مباشرة على لوحات تحكم الموظفين.</span>
            </div>
          </div>
        </div>
      )}

      {/* STAFF MEMBERS VIEW */}
      {subTab === "staff" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Search Input */}
            <div className="relative max-w-md flex-1">
              <Search className="pointer-events-none absolute inset-y-0 start-3 my-auto h-4 w-4 text-faint" />
              <input
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                placeholder="ابحث عن موظف بالاسم، البريد أو الدور..."
                className="h-10 w-full rounded-xl border border-line bg-surface ps-9 pe-3 text-xs text-ink placeholder:text-faint focus:border-rose-400 focus:outline-none focus:ring-1 focus:ring-rose-400"
              />
            </div>
            {/* Action Buttons */}
            <button
              onClick={() => setShowStaffModal(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 px-3.5 py-2 text-xs font-bold text-white transition hover:brightness-110 shadow-sm"
            >
              <UserPlus className="h-3.5 w-3.5" /> إضافة موظف للمنصة
            </button>
          </div>

          {/* Staff Members List */}
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead>
                  <tr className="border-b border-line bg-elevated/40 text-[11px] font-bold text-faint">
                    <th className="px-4 py-3.5 text-start font-semibold text-ink">الاسم والبيانات</th>
                    <th className="px-4 py-3.5 text-start font-semibold text-ink">البريد الإلكتروني</th>
                    <th className="px-4 py-3.5 text-center font-semibold text-ink">الدور والـ Role المعين</th>
                    <th className="px-4 py-3.5 text-center font-semibold text-ink">حالة الحساب</th>
                    <th className="px-4 py-3.5 text-center font-semibold text-ink">تاريخ التعيين</th>
                    <th className="px-4 py-3.5 text-center font-semibold text-ink">التحكم</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-xs text-muted">
                        لا يوجد موظفون يطابقون بحثك حالياً.
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((member) => {
                      return (
                        <tr key={member.id} className="border-b border-line/40 last:border-0 hover:bg-elevated/25 transition">
                          {/* Name */}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-rose-500/10 to-rose-600/5 text-[10px] font-bold text-rose-600">
                                {member.name.slice(0, 2)}
                              </div>
                              <div>
                                <p className="font-semibold text-xs text-ink">{member.name}</p>
                                <p className="text-[10px] text-faint">ID: {member.id}</p>
                              </div>
                            </div>
                          </td>

                          {/* Email */}
                          <td className="px-4 py-3.5 text-xs text-muted">
                            <div className="flex items-center gap-1">
                              <Mail className="h-3 w-3 text-faint" />
                              <span>{member.email}</span>
                            </div>
                          </td>

                          {/* Assigned Role */}
                          <td className="px-4 py-3.5 text-center">
                            {member.email === admin.email ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600">
                                <ShieldCheck className="h-3 w-3" />
                                المدير العام للشركة
                              </span>
                            ) : (
                              <select
                                value={member.roleId}
                                onChange={(e) => handleAssignRole(member.id, e.target.value)}
                                className="h-8 rounded-lg border border-line bg-surface px-2 text-xs text-ink focus:border-rose-400 focus:outline-none"
                              >
                                {roles.map((r) => (
                                  <option key={r.id} value={r.id}>
                                    {r.nameAr}
                                  </option>
                                ))}
                              </select>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5 text-center">
                            <span
                              className={cn(
                                "rounded-full px-2 py-0.5 text-[10px] font-bold",
                                member.status === "active"
                                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                                  : "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                              )}
                            >
                              {member.status === "active" ? "نشط ومفعل" : "مجمد وموقوف"}
                            </span>
                          </td>

                          {/* Date Added */}
                          <td className="px-4 py-3.5 text-center text-xs text-muted">
                            {new Date(member.createdAt).toLocaleDateString("ar-EG")}
                          </td>

                          {/* Control actions */}
                          <td className="px-4 py-3.5 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {member.email !== admin.email && (
                                <>
                                  <button
                                    onClick={() => handleToggleStaffStatus(member.id)}
                                    className={cn(
                                      "rounded-lg px-2 py-1 text-[10px] font-semibold transition border",
                                      member.status === "active"
                                        ? "bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200 dark:bg-rose-500/10 dark:text-rose-200 dark:border-rose-500/20"
                                        : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:border-emerald-500/20"
                                    )}
                                  >
                                    {member.status === "active" ? "تجميد الحساب" : "إعادة تفعيل"}
                                  </button>
                                  <button
                                    onClick={() => handleDeleteStaff(member.id, member.name)}
                                    className="rounded-lg bg-elevated text-faint hover:text-rose-600 hover:bg-rose-50 border border-line p-1 transition"
                                    title="حذف حساب الموظف نهائياً"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* NEW CUSTOM ROLE MODAL */}
      <AnimatePresence>
        {showRoleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="h-5 w-5 text-rose-600" />
                  <h3 className="text-sm font-bold text-ink">إنشاء دور مخصص جديد</h3>
                </div>
                <button
                  onClick={() => setShowRoleModal(false)}
                  className="rounded-lg p-1 text-muted hover:bg-elevated hover:text-ink transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateRole} className="mt-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted">اسم الدور المخصص (بالعربية)</label>
                  <input
                    required
                    value={roleForm.nameAr}
                    onChange={(e) => setRoleForm({ ...roleForm, nameAr: e.target.value })}
                    placeholder="مثال: مسؤول مالي وإعلانات"
                    className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-rose-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted">اسم الدور (بالأجنبية/الإنجليزية)</label>
                  <input
                    required
                    value={roleForm.nameEn}
                    onChange={(e) => setRoleForm({ ...roleForm, nameEn: e.target.value })}
                    placeholder="مثال: Ads & Finance Manager"
                    className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-rose-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted">نسخ الصلاحيات الأولية من قالب (Template)</label>
                  <select
                    value={roleForm.baseTemplate}
                    onChange={(e) => setRoleForm({ ...roleForm, baseTemplate: e.target.value })}
                    className="h-10 w-full rounded-xl border border-line bg-surface px-2 text-xs text-ink focus:border-rose-400 focus:outline-none"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nameAr} ({r.nameEn})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted">أيقونة الدور التعبيرية</label>
                  <div className="grid grid-cols-5 gap-2">
                    {["headphones", "dollar", "code", "moderator", "custom"].map((ic) => (
                      <button
                        type="button"
                        key={ic}
                        onClick={() => setRoleForm({ ...roleForm, icon: ic })}
                        className={cn(
                          "flex flex-col items-center justify-center p-2 rounded-xl border transition-all",
                          roleForm.icon === ic
                            ? "bg-rose-500/10 border-rose-500 text-rose-600"
                            : "bg-elevated/40 border-line text-muted hover:bg-elevated hover:text-ink"
                        )}
                      >
                        {getRoleIconComponent(ic, "h-5 w-5")}
                        <span className="text-[9px] mt-1 capitalize">{ic}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2 border-t border-line pt-4 mt-6">
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 py-2.5 text-xs font-bold text-white transition hover:brightness-110"
                  >
                    إنشاء وحفظ الدور مخصص
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRoleModal(false)}
                    className="flex-1 rounded-xl bg-elevated py-2.5 text-xs font-bold text-muted hover:text-ink border border-line"
                  >
                    إلغاء التراجع
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* NEW STAFF MEMBER MODAL */}
      <AnimatePresence>
        {showStaffModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface p-5 sm:p-6 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-line pb-3">
                <div className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-rose-600" />
                  <h3 className="text-sm font-bold text-ink">إضافة حساب موظف للمنصة</h3>
                </div>
                <button
                  onClick={() => setShowStaffModal(false)}
                  className="rounded-lg p-1 text-muted hover:bg-elevated hover:text-ink transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleAddStaff} className="mt-4 space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted">الاسم الكامل للموظف</label>
                  <input
                    required
                    value={staffForm.name}
                    onChange={(e) => setStaffForm({ ...staffForm, name: e.target.value })}
                    placeholder="مثال: أحمد عبد الله"
                    className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-rose-400 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted">عنوان البريد الإلكتروني</label>
                  <input
                    required
                    type="email"
                    value={staffForm.email}
                    onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                    placeholder="مثال: employee@company.com"
                    className="h-10 w-full rounded-xl border border-line bg-surface px-3 text-xs text-ink focus:border-rose-400 focus:outline-none"
                  />
                  <span className="text-[9px] text-faint block">سيتم تفعيل تسجيل دخول الموظف بهذا البريد فوراً وتعيين الصلاحيات.</span>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-muted">الدور والصلاحيات الافتراضية للتعيين</label>
                  <select
                    value={staffForm.roleId}
                    onChange={(e) => setStaffForm({ ...staffForm, roleId: e.target.value })}
                    className="h-10 w-full rounded-xl border border-line bg-surface px-2 text-xs text-ink focus:border-rose-400 focus:outline-none"
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.nameAr} ({r.nameEn})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2 border-t border-line pt-4 mt-6">
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 py-2.5 text-xs font-bold text-white transition hover:brightness-110"
                  >
                    إضافة الموظف وتأكيد الحساب
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowStaffModal(false)}
                    className="flex-1 rounded-xl bg-elevated py-2.5 text-xs font-bold text-muted hover:text-ink border border-line"
                  >
                    إلغاء التراجع
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

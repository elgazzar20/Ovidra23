import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, BellRing, Check, Eye, X, Clock, Info } from "lucide-react";
import { useApp } from "../context/AppContext";
import { fetchPlatformNotifications, type PlatformNotification } from "../lib/superadmin";
import { cn } from "../utils/cn";
import { FIREBASE_ENABLED, db as firestoreDb, auth } from "../lib/firebase";
import { collection, onSnapshot, query, orderBy, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export function NotificationBell() {
  const { lang, user, subscriptionPlan, subscriptionStatus, centerStatus, subscriptionEndDate } = useApp();
  const [platformNotifications, setPlatformNotifications] = useState<PlatformNotification[]>([]);
  const [directNotifications, setDirectNotifications] = useState<PlatformNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const centerId = user?.centerId || "demo-center-futureminds";
  const readKey = `cpd_read_notifs_${centerId}`;

  const notifications = useMemo(() => {
    return [...directNotifications, ...platformNotifications].sort((a, b) => b.createdAt - a.createdAt);
  }, [platformNotifications, directNotifications]);

  // Load read status from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(readKey);
      if (stored) {
        setReadIds(JSON.parse(stored));
      } else {
        setReadIds([]);
      }
    } catch {
      setReadIds([]);
    }
  }, [readKey]);

  const [fbUser, setFbUser] = useState<any>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Monitor Firebase Auth state changes
  useEffect(() => {
    if (!auth) {
      setAuthChecked(true);
      return;
    }
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setFbUser(u);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, []);

  // Fetch platform notifications from Firestore
  const loadNotifications = async () => {
    setLoading(true);
    try {
      const data = await fetchPlatformNotifications();
      setPlatformNotifications(data);
    } catch (e) {
      console.error("[NotificationBell] Failed to fetch notifications:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authChecked) return;

    if (FIREBASE_ENABLED && firestoreDb && fbUser) {
      const q = query(collection(firestoreDb, "platform_notifications"), orderBy("createdAt", "desc"));
      const unsubscribe1 = onSnapshot(q, (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as PlatformNotification));
        setPlatformNotifications(list);
        localStorage.setItem("cpd_local_platform_notifications", JSON.stringify(list));
      }, (error) => {
        console.warn("[NotificationBell] Real-time fetch error (falling back to static fetch):", error.message);
        loadNotifications();
      });

      let unsubscribe2 = () => {};
      if (user?.uid) {
        const q2 = query(collection(firestoreDb, "notifications"), where("recipientUid", "==", user.uid));
        unsubscribe2 = onSnapshot(q2, (snapshot) => {
          const list = snapshot.docs.map((d) => {
            const data = d.data();
            return {
              id: d.id,
              title: data.title || (lang === "ar" ? "رسالة من إدارة المنصة" : "Message from Platform Management"),
              body: data.body || "",
              priority: "high",
              targetType: "all",
              status: "sent",
              sentAt: data.createdAt || Date.now(),
              createdAt: data.createdAt || Date.now()
            } as PlatformNotification;
          });
          setDirectNotifications(list);
        }, (error) => {
          console.warn("[NotificationBell] Real-time direct fetch error:", error.message);
        });
      }

      return () => {
        unsubscribe1();
        unsubscribe2();
      };
    } else {
      loadNotifications();
      // Refresh notifications every 5 minutes in background if not realtime
      const interval = setInterval(loadNotifications, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [authChecked, fbUser, centerId, user?.uid, lang]);

  // Save read status to localStorage
  const saveReadIds = (ids: string[]) => {
    setReadIds(ids);
    try {
      localStorage.setItem(readKey, JSON.stringify(ids));
    } catch (err) {
      console.error("[NotificationBell] Save read status failed:", err);
    }
  };

  // Filter notifications that match targeting criteria for this center
  const targetedNotifications = notifications.filter((notif) => {
    // Must be sent, or scheduled and the schedule time has already passed
    const isSent = notif.status === "sent";
    const isScheduledAndPassed = notif.status === "scheduled" && notif.scheduledAt && notif.scheduledAt <= Date.now();
    
    if (!isSent && !isScheduledAndPassed) return false;

    // Plan check
    const plan = subscriptionPlan || "free";

    // Target filters
    if (notif.targetType === "all") return true;
    if (notif.targetType === "selected") {
      return notif.targetIds?.includes(centerId) || false;
    }
    if (notif.targetType === "plan") {
      return notif.targetPlan === plan;
    }
    if (notif.targetType === "status") {
      const currentSubStatus = subscriptionStatus || "trialing";
      const currentCenterStatus = centerStatus || "active";
      return notif.targetStatus === currentCenterStatus || notif.targetStatus === currentSubStatus || notif.targetStatus === "active";
    }

    return false;
  });

  const dynamicNotifs: PlatformNotification[] = [];
  const daysRemaining = subscriptionEndDate ? Math.ceil((subscriptionEndDate - Date.now()) / (1000 * 60 * 60 * 24)) : null;
  const isExpired = subscriptionPlan !== "free" && (subscriptionEndDate ? subscriptionEndDate < Date.now() : false);
  const isExpiringSoon = subscriptionPlan !== "free" && daysRemaining !== null && daysRemaining <= 7 && daysRemaining >= 0;

  if (isExpired) {
    dynamicNotifs.push({
      id: "sys_notif_expired",
      title: lang === "ar" ? "انتهى اشتراك باقتك" : "Subscription Expired",
      body: lang === "ar" 
        ? `انتهت صلاحية اشتراكك في باقة (${subscriptionPlan === "enterprise" ? "مؤسسي" : "احترافي"}). يرجى التجديد لتجنب وضع القراءة فقط وحظر الميزات.`
        : `Your (${subscriptionPlan}) subscription has expired. Please renew to keep all features unlocked.`,
      priority: "high",
      status: "sent",
      targetType: "all",
      createdAt: subscriptionEndDate || Date.now()
    });
  } else if (isExpiringSoon && daysRemaining !== null) {
    dynamicNotifs.push({
      id: `sys_notif_expiring_${daysRemaining}`,
      title: lang === "ar" ? "اقتراب موعد انتهاء الاشتراك" : "Subscription Expiring Soon",
      body: lang === "ar"
        ? `باقي ${daysRemaining} أيام على انتهاء اشتراك باقة (${subscriptionPlan === "enterprise" ? "مؤسسي" : "احترافي"}). يرجى تجديد الاشتراك مبكراً لتجنب انقطاع الخدمات.`
        : `Your (${subscriptionPlan}) subscription is expiring in ${daysRemaining} days. Please renew to avoid service disruption.`,
      priority: "medium",
      status: "sent",
      targetType: "all",
      createdAt: Date.now()
    });
  }

  const allNotifications = [...dynamicNotifs, ...targetedNotifications];

  const unreadNotifications = allNotifications.filter(
    (n) => !readIds.includes(n.id)
  );

  const handleMarkAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      saveReadIds([...readIds, id]);
    }
  };

  const handleMarkAllAsRead = () => {
    const allIds = allNotifications.map((n) => n.id);
    saveReadIds(allIds);
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case "high":
        return "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-300";
      case "medium":
        return "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-300";
      default:
        return "bg-slate-50 border-slate-200 text-slate-700 dark:bg-slate-500/10 dark:border-slate-500/20 dark:text-slate-300";
    }
  };

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        onClick={() => {
          setIsOpen(true);
          loadNotifications(); // Refresh on open
        }}
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border border-line text-ink hover:bg-elevated cursor-pointer transition active:scale-95",
          unreadNotifications.length > 0 && "text-brand-600 dark:text-brand-400"
        )}
        title={lang === "ar" ? "الإشعارات والتنبيهات" : "Notifications & Alerts"}
      >
        {unreadNotifications.length > 0 ? (
          <BellRing className="h-4.5 w-4.5 animate-bounce" />
        ) : (
          <Bell className="h-4.5 w-4.5" />
        )}

        {unreadNotifications.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-extrabold text-white">
            {unreadNotifications.length}
          </span>
        )}
      </button>

      {/* Drawer Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[60] bg-slate-950/45 backdrop-blur-xs"
            />

            {/* Sliding Drawer */}
            <motion.div
              initial={{ x: lang === "ar" ? "-100%" : "100%" }}
              animate={{ x: 0 }}
              exit={{ x: lang === "ar" ? "-100%" : "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 220 }}
              className={cn(
                "fixed top-0 bottom-0 z-[70] w-full max-w-md border-line bg-surface p-0 shadow-2xl flex flex-col h-screen max-h-screen",
                lang === "ar" ? "left-0 border-r" : "right-0 border-l"
              )}
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-line px-5 py-4 bg-elevated/40 shrink-0">
                <div className="flex items-center gap-2">
                  <BellRing className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                  <h3 className="font-bold text-ink text-sm sm:text-base">
                    {lang === "ar" ? "مركز التنبيهات العام" : "Notification Center"}
                  </h3>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="rounded-lg p-1 text-muted hover:bg-elevated hover:text-ink transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Action bar if there are unread items */}
              {unreadNotifications.length > 0 && (
                <div className="flex items-center justify-between border-b border-line bg-brand-500/5 px-5 py-2.5 shrink-0">
                  <span className="text-[10px] font-bold text-brand-700 dark:text-brand-300">
                    {lang === "ar"
                      ? `لديك ${unreadNotifications.length} تنبيهات غير مقروءة`
                      : `You have ${unreadNotifications.length} unread alerts`}
                  </span>
                  <button
                    onClick={handleMarkAllAsRead}
                    className="inline-flex items-center gap-1 text-[10px] font-extrabold text-brand-600 hover:text-brand-700 dark:text-brand-300 dark:hover:text-brand-200 cursor-pointer"
                  >
                    <Check className="h-3 w-3" />
                    {lang === "ar" ? "تحديد الكل كمقروء" : "Mark all as read"}
                  </button>
                </div>
              )}

              {/* Notification List Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3.5 cp-scroll min-h-0">
                {loading && notifications.length === 0 ? (
                  <div className="flex justify-center py-10">
                    <span className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-600" />
                  </div>
                ) : allNotifications.length === 0 ? (
                  <div className="py-16 text-center text-muted">
                    <Bell className="mx-auto h-8 w-8 text-faint opacity-50 mb-2" />
                    <p className="text-xs">
                      {lang === "ar"
                        ? "لا توجد تنبيهات أو إعلانات عامة واردة حالياً."
                        : "No general alerts or announcements received yet."}
                    </p>
                  </div>
                ) : (
                  allNotifications.map((notif) => {
                    const isUnread = !readIds.includes(notif.id);
                    return (
                      <div
                        key={notif.id}
                        onClick={() => handleMarkAsRead(notif.id)}
                        className={cn(
                          "relative rounded-xl border p-4 transition shadow-sm hover:shadow-md",
                          isUnread
                            ? "bg-brand-500/[0.04] border-brand-200 hover:bg-brand-500/[0.08] cursor-pointer dark:border-brand-500/30"
                            : "bg-surface border-line hover:bg-elevated/10"
                        )}
                      >
                        {/* Status bar indication */}
                        {isUnread && (
                          <span className={cn(
                            "absolute top-0 bottom-0 w-1 rounded-s-xl",
                            lang === "ar" ? "right-0" : "left-0",
                            notif.priority === "high" ? "bg-rose-500" : "bg-brand-500"
                          )} />
                        )}

                        <div className="space-y-2 min-w-0">
                          {/* Metadata row */}
                          <div className="flex items-center justify-between gap-2">
                            <span className={cn(
                              "rounded-full border px-2 py-0.5 text-[9px] font-extrabold tracking-wide uppercase",
                              getPriorityColor(notif.priority)
                            )}>
                              {notif.priority === "high"
                                ? (lang === "ar" ? "عاجل" : "urgent")
                                : notif.priority === "medium"
                                  ? (lang === "ar" ? "متوسط" : "medium")
                                  : (lang === "ar" ? "عادي" : "normal")}
                            </span>

                            <div className="flex items-center gap-1 text-[10px] text-faint">
                              <Clock className="h-3.5 w-3.5" />
                              <span>
                                {notif.sentAt
                                  ? new Date(notif.sentAt).toLocaleDateString(
                                      lang === "ar" ? "ar-EG" : "en-US",
                                      { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
                                    )
                                  : ""}
                              </span>
                            </div>
                          </div>

                          {/* Title */}
                          <h4 className={cn(
                            "font-bold text-ink text-sm sm:text-[15px] leading-snug",
                            isUnread && "text-brand-900 dark:text-brand-100"
                          )}>
                            {notif.title}
                          </h4>

                          {/* Body - supporting markdown multi-line natively */}
                          <div className="text-[12px] sm:text-[13px] leading-relaxed text-muted whitespace-pre-wrap select-text">
                            {notif.body}
                          </div>

                          {/* Read indicator trigger */}
                          {isUnread && (
                            <div className="flex justify-end pt-1">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsRead(notif.id);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-extrabold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                              >
                                <Eye className="h-3 w-3" />
                                {lang === "ar" ? "قراءة" : "Mark read"}
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Footer info banner */}
              <div className="border-t border-line bg-elevated/40 p-4 text-[11px] text-muted flex gap-2 items-start shrink-0">
                <Info className="h-4 w-4 shrink-0 text-brand-500 mt-0.5" />
                <p className="leading-normal">
                  {lang === "ar"
                    ? "هذه الإشعارات مرسلة مباشرة من قبل فريق منصة أوفيدرا لمتابعة تحديثات النظام وأمور الحساب والخدمة."
                    : "These alerts are published directly by the Ovidra platform team for system updates and account billing reminders."}
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

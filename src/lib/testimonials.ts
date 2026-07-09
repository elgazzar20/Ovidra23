export interface Testimonial {
  id: string;
  name: string;
  role: string;
  text: string;
  rating: number;
  approved: boolean;
  createdAt: number;
}

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    id: "t1",
    name: "أ. أحمد مصطفى",
    role: "صاحب سنتر النخبة",
    text: "وفّر عليّ البرنامج ساعات يومياً. الحضور والرسوم أصبحت بنقرة واحدة والتنبيهات فورية لأولياء الأمور.",
    rating: 5,
    approved: true,
    createdAt: 1717200000000,
  },
  {
    id: "t2",
    name: "أ. سارة عبد الله",
    role: "مديرة سنتر المستقبل",
    text: "التقارير الذكية والذكاء الاصطناعي ساعداني أكتشف الطلاب المتعثرين مبكراً ومتابعة أجور المعلمين بمنتهى الدقة والشفافية.",
    rating: 5,
    approved: true,
    createdAt: 1717300000000,
  },
  {
    id: "t3",
    name: "أ. خالد فؤاد",
    role: "مدير أكاديمية المعرفة",
    text: "أفضل نظام إدارة استخدمته على الإطلاق. خصوصية البيانات الكاملة والعمل دون إنترنت تمنحنا راحة بال حقيقية واحترافية لا تضاهى.",
    rating: 5,
    approved: true,
    createdAt: 1717400000000,
  },
  {
    id: "t4",
    name: "أ. محمود عبد الرحمن",
    role: "صاحب سنتر الأوائل التعليمي",
    text: "كنا نعاني من كثرة الدفاتر الورقية وتلفها، نظام كروت الـ QR الثنائية والمسح السريع نقل السنتر الخاص بنا لمستوى آخر تماماً.",
    rating: 5,
    approved: true,
    createdAt: 1717500000000,
  },
  {
    id: "t5",
    name: "أ. رانيا يوسف",
    role: "مديرة أكاديمية المتفوقين",
    text: "الميزات المالية والتقارير الشهرية تجعل حسابات السنتر في غاية السهولة، وتمنع أي تداخل في حساب نسب المعلمين.",
    rating: 5,
    approved: true,
    createdAt: 1717600000000,
  },
  {
    id: "t6",
    name: "أ. عمرو سلامة",
    role: "مدير سنتر مودرن ساينس",
    text: "خدمة العملاء والدعم الفني سريعون جداً، والبرنامج يتم تحديثه بميزات مذهلة باستمرار دون أي رسوم إضافية مخفية.",
    rating: 5,
    approved: true,
    createdAt: 1717700000000,
  },
  {
    id: "t7",
    name: "أ. هاني السعيد",
    role: "صاحب سلسلة مراكز الفيصل",
    text: "إمكانية تشغيل النظام في الفروع المتعددة وعزل بيانات كل فرع مع إشراف مركزي متكامل كان حلماً وحققته لنا أوفيدرا.",
    rating: 5,
    approved: true,
    createdAt: 1717800000000,
  }
];

const STORAGE_KEY = "ovidra_platform_testimonials";

export function getTestimonials(): Testimonial[] {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TESTIMONIALS));
    return DEFAULT_TESTIMONIALS;
  }
  try {
    return JSON.parse(data);
  } catch (e) {
    return DEFAULT_TESTIMONIALS;
  }
}

export function saveTestimonials(list: Testimonial[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function addTestimonial(name: string, role: string, text: string, rating: number = 5): Testimonial {
  const list = getTestimonials();
  const newItem: Testimonial = {
    id: "t_" + Date.now(),
    name: name.trim() || "زائر كريم",
    role: role.trim() || "صاحب مركز تعليمي",
    text: text.trim(),
    rating,
    approved: false, // Pending Super Admin approval!
    createdAt: Date.now()
  };
  list.push(newItem);
  saveTestimonials(list);
  return newItem;
}

export function approveTestimonial(id: string) {
  const list = getTestimonials();
  const item = list.find(t => t.id === id);
  if (item) {
    item.approved = true;
    saveTestimonials(list);
  }
}

export function deleteTestimonial(id: string) {
  const list = getTestimonials();
  const filtered = list.filter(t => t.id !== id);
  saveTestimonials(filtered);
}

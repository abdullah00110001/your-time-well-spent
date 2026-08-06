export interface MonthlyTheme {
  month: number;
  titleBn: string;
  titleEn: string;
  descriptionBn: string;
  descriptionEn: string;
  icon: string;
  color: string;
}

export const monthlyThemes: MonthlyTheme[] = [
  {
    month: 1,
    titleBn: 'শুরু ও ডিসিপ্লিন',
    titleEn: 'Start & Discipline',
    descriptionBn: 'অনেক তো হলো আলসেমি, এবার একটু ট্র্যাকে ফেরার পালা। লাইফটাকে একটা সলিড সিস্টেমে নিয়ে আসি।',
    descriptionEn: 'Enough laziness, time to get back on track. Let\'s bring life into a solid system.',
    icon: 'Rocket',
    color: '#8FAE8B'
  },
  {
    month: 2,
    titleBn: 'ঘুম ও এনার্জি',
    titleEn: 'Sleep & Energy',
    descriptionBn: 'বডিকে চার্জ দেওয়ার মাস। ঠিকঠাক ঘুম আর হেলদি লাইফস্টাইল দিয়ে নিজের এনার্জি লেভেল বুস্ট করা।',
    descriptionEn: 'Month to charge your body. Boost energy levels with proper sleep and healthy lifestyle.',
    icon: 'Moon',
    color: '#7FBFB5'
  },
  {
    month: 3,
    titleBn: 'শরীর সচল রাখা',
    titleEn: 'Keep Body Active',
    descriptionBn: 'সোফায় বসে থাকা বাদ, এবার একটু নড়াচড়া। শরীরটা ফিট থাকলে মনটাও চনমনে থাকবে।',
    descriptionEn: 'No more couch sitting, time to move. A fit body means a fresh mind.',
    icon: 'Dumbbell',
    color: '#E8B4B4'
  },
  {
    month: 4,
    titleBn: 'স্ক্রিন টাইম ও ফোকাস',
    titleEn: 'Screen Time & Focus',
    descriptionBn: 'ফোনের নোটিফিকেশন অফ, নিজের গ্রোথ অন। স্ক্রিন টাইম কমিয়ে কাজের ফোকাসটা নেক্সট লেভেলে নেওয়া।',
    descriptionEn: 'Phone notifications off, personal growth on. Reduce screen time, elevate focus.',
    icon: 'Eye',
    color: '#B8A9C9'
  },
  {
    month: 5,
    titleBn: 'বই পড়া ও জ্ঞানচর্চা',
    titleEn: 'Reading & Knowledge',
    descriptionBn: 'ব্রেনকে ফিড করার সময়। সোশ্যাল মিডিয়ার ফিড না ঘেঁটে এবার বইয়ের পাতা উল্টানো।',
    descriptionEn: 'Time to feed the brain. Skip social media feeds, turn book pages instead.',
    icon: 'BookOpen',
    color: '#F5C89A'
  },
  {
    month: 6,
    titleBn: 'রিফ্লেকশন ও মাইন্ডফুলনেস',
    titleEn: 'Reflection & Mindfulness',
    descriptionBn: 'মিড-ইয়ার রিভিউ। একটু শান্ত হয়ে বসা, নিজেকে সময় দেওয়া আর মেন্টাল পিস খুঁজে বের করা।',
    descriptionEn: 'Mid-year review. Sit quietly, give yourself time, find mental peace.',
    icon: 'Heart',
    color: '#A8D5BA'
  },
  {
    month: 7,
    titleBn: 'স্কিল ডেভেলপমেন্ট',
    titleEn: 'Skill Development',
    descriptionBn: 'নিজেকে আপগ্রেড করার মিশন। নতুন একটা স্কিল ধরবো আর সেটাতে বস হওয়ার ট্রাই করবো।',
    descriptionEn: 'Mission to upgrade yourself. Learn a new skill and try to master it.',
    icon: 'Zap',
    color: '#FFD93D'
  },
  {
    month: 8,
    titleBn: 'কনসিসটেন্সি',
    titleEn: 'Consistency',
    descriptionBn: 'মোটিভেশন দিয়ে শুরু হয়, কিন্তু অভ্যাস দিয়ে টিকে থাকতে হয়। কোনো গ্যাপ না দিয়ে লেগে থাকার চ্যালেঞ্জ।',
    descriptionEn: 'Motivation starts it, but habits sustain it. Challenge to stay consistent without gaps.',
    icon: 'Repeat',
    color: '#FF8B8B'
  },
  {
    month: 9,
    titleBn: 'ডিপ ওয়ার্ক ও প্রোডাক্টিভিটি',
    titleEn: 'Deep Work & Productivity',
    descriptionBn: 'ডিস্ট্রাকশনকে টা-টা বাই-বাই। দিনে কয়েক ঘণ্টা এমন কাজ করা যেখানে দুনিয়ার আর কিছু মাথায় থাকবে না।',
    descriptionEn: 'Say goodbye to distractions. Work hours where nothing else matters.',
    icon: 'Focus',
    color: '#6C9BCF'
  },
  {
    month: 10,
    titleBn: 'লাইফ ব্যালান্স',
    titleEn: 'Life Balance',
    descriptionBn: 'শুধু ক্যারিয়ার না, লাইফটা এনজয়ও করতে হবে। আপনজনদের সময় দেওয়া আর নিজের শখগুলো পূরণ করা।',
    descriptionEn: 'Not just career, enjoy life too. Give time to loved ones and pursue hobbies.',
    icon: 'Scale',
    color: '#98D8C8'
  },
  {
    month: 11,
    titleBn: 'গ্রোথ ও আত্মবিশ্বাস',
    titleEn: 'Growth & Confidence',
    descriptionBn: "নিজের ভয়গুলোকে ফেস করার সময়। 'পারবো না' বলে কিছু নেই, কনফিডেন্স নিয়ে ঝাঁপিয়ে পড়া।",
    descriptionEn: "Time to face your fears. There's no 'I can't', dive in with confidence.",
    icon: 'TrendingUp',
    color: '#DDA0DD'
  },
  {
    month: 12,
    titleBn: 'রিভিউ ও রিসেট',
    titleEn: 'Review & Reset',
    descriptionBn: 'ফাইনাল ক্লোজিং। কী হারালো আর কী পেলাম—সবকিছুর হিসাব মিলিয়ে সামনের জন্য আরও স্ট্রং হওয়া।',
    descriptionEn: 'Final closing. Calculate wins and losses, become stronger for the future.',
    icon: 'RefreshCw',
    color: '#C9B1FF'
  }
];

export const getMonthName = (month: number, language: 'en' | 'bn'): string => {
  const monthsBn = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  const monthsEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return language === 'bn' ? monthsBn[month - 1] : monthsEn[month - 1];
};

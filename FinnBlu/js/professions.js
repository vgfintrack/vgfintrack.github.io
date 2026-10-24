// What people do for a living, in English and Bangla with everyday spellings,
// and the starting setup each one gets. Loaded only by the first-run setup.
// Category names stay in English: they are the user's data, and reports are in English.

// ---- personal money: who you are decides the usual income and spending
export const PERSONAL = {
  student: { expense: ['Food', 'Transport', 'Study & Books', 'Mobile & Internet', 'Hostel & Mess', 'Entertainment', 'Medical', 'Other'], income: ['Family Allowance', 'Tuition', 'Scholarship', 'Other Income'] },
  job: { expense: ['Food', 'Transport', 'House Rent', 'Utility Bills', 'Mobile & Internet', 'Family Support', 'Medical', 'Shopping', 'Other'], income: ['Salary', 'Bonus', 'Other Income'] },
  teacher: { expense: ['Food', 'Transport', 'House Rent', 'Utility Bills', 'Mobile & Internet', 'Study & Books', 'Family Support', 'Medical', 'Other'], income: ['Salary', 'Tuition', 'Other Income'] },
  doctor: { expense: ['Food', 'Transport', 'House Rent', 'Utility Bills', 'Mobile & Internet', 'Books & Courses', 'Family Support', 'Medical', 'Other'], income: ['Salary', 'Chamber Fees', 'Other Income'] },
  lawyer: { expense: ['Food', 'Transport', 'House Rent', 'Utility Bills', 'Mobile & Internet', 'Chamber Rent', 'Family Support', 'Medical', 'Other'], income: ['Client Fees', 'Salary', 'Other Income'] },
  freelancer: { expense: ['Food', 'Transport', 'House Rent', 'Utility Bills', 'Mobile & Internet', 'Software & Tools', 'Family Support', 'Medical', 'Other'], income: ['Client Payment', 'Upwork / Fiverr', 'Other Income'] },
  worker: { expense: ['Food', 'Transport', 'House Rent', 'Family Support', 'Mobile & Internet', 'Medical', 'Savings (DPS)', 'Other'], income: ['Salary', 'Overtime', 'Other Income'] },
  driver: { expense: ['Vehicle Rent (Joma)', 'Fuel & Charging', 'Vehicle Repairs', 'Food', 'Family Support', 'Mobile & Internet', 'Medical', 'Other'], income: ['Daily Earnings', 'Other Income'] },
  labour: { expense: ['Food', 'Transport', 'House Rent', 'Family Support', 'Mobile & Internet', 'Medical', 'Other'], income: ['Daily Wages', 'Other Income'] },
  retired: { expense: ['Food', 'Bazar & Groceries', 'Utility Bills', 'Medical', 'Family Support', 'Gifts & Dawat', 'Other'], income: ['Pension', 'Money from Family', 'Savings Profit', 'Rent Received', 'Other Income'] },
  probashi: { expense: ['Money Sent Home', 'Food', 'House Rent', 'Mobile & Internet', 'Transport', 'Medical', 'Savings', 'Other'], income: ['Salary', 'Overtime', 'Other Income'] },
  home: { expense: ['Bazar & Groceries', 'Utility Bills', 'House Rent', "Children's Education", 'Transport', 'Medical', 'Family Support', 'Other'], income: ['Household Money', 'Money from Family', 'Salary', 'Other Income'] },
  business: { expense: ['Food', 'Transport', 'House Rent', 'Utility Bills', 'Mobile & Internet', 'Family Support', "Children's Education", 'Medical', 'Other'], income: ['Business Profit', 'Rent Received', 'Other Income'] },
  other: { expense: ['Food', 'Transport', 'House Rent', 'Utility Bills', 'Mobile & Internet', 'Family Support', 'Medical', 'Shopping', 'Other'], income: ['Main Income', 'Other Income'] },
};

export const PERSONAL_EXTRA = {
  expense: ['Food', 'Transport', 'House Rent', 'Utility Bills', 'Mobile & Internet', 'Family Support', 'Medical', 'Shopping', 'Entertainment', 'Gifts & Dawat', 'Clothing', 'Personal Care', 'Savings (DPS)', "Children's Education", 'Other'],
  income: ['Salary', 'Bonus', 'Tuition', 'Business Profit', 'Rent Received', 'Money from Family', 'Gift Received', 'Other Income'],
};

// ---- a business's own money: what it buys, spends on and earns from
const RUNNING = ['Shop Rent', 'Electricity', 'Staff Salary', 'Transport & Delivery', 'Mobile & Internet'];
export const BUSINESS = {
  grocery: { stock: 'Stock Purchase', expense: ['Stock Purchase', ...RUNNING, 'Packaging', 'Other'], income: ['Sales', 'Other Income'], products: ['Rice & Grains', 'Oil & Ghee', 'Spices', 'Tea & Sugar', 'Biscuits & Snacks', 'Drinks', 'Soap & Detergent', 'Toiletries', 'Eggs & Dairy', 'Cigarettes', 'Stationery', 'Other goods'] },
  pharmacy: { stock: 'Medicine Purchase', expense: ['Medicine Purchase', ...RUNNING, 'Drug Licence & Fees', 'Fridge & Cold Storage', 'Other'], income: ['Medicine Sales', 'Other Income'], products: ['Tablets & Capsules', 'Syrups', 'Injections & Saline', 'Baby Care', 'Medical Devices', 'Personal Care', 'Other goods'] },
  electronics: { stock: 'Stock Purchase', expense: ['Stock Purchase', ...RUNNING, 'Repair Parts', 'Warranty & Returns', 'Other'], income: ['Sales', 'Repair Service', 'Other Income'], products: ['Fans & Lights', 'TV & Fridge', 'Wires & Switches', 'Batteries & Chargers', 'Kitchen Appliances', 'Other goods'] },
  mobile: { stock: 'Stock Purchase', expense: ['Stock Purchase', ...RUNNING, 'Repair Parts', 'Other'], income: ['Phone Sales', 'Accessories Sales', 'Flexiload Commission', 'Repair Service', 'Other Income'], products: ['Mobile Phones', 'Chargers & Cables', 'Covers & Glass', 'Earphones', 'SIM & Scratch Cards', 'Other goods'] },
  stationery: { stock: 'Stock Purchase', expense: ['Stock Purchase', ...RUNNING, 'Printer Ink & Paper', 'Other'], income: ['Sales', 'Photocopy & Printing', 'Other Income'], products: ['Pens & Pencils', 'Khata & Paper', 'Books', 'School Bags', 'Art & Craft', 'Other goods'] },
  clothing: { stock: 'Stock Purchase', expense: ['Stock Purchase', ...RUNNING, 'Tailoring', 'Other'], income: ['Sales', 'Other Income'], products: ['Sharee', 'Three-piece', 'Shirts & Pants', 'Kids Wear', 'Fabric', 'Other goods'] },
  // Computer & photocopy shop (cyber café, digital centre): mostly services. Government
  // fees taken from customers go in and out again, so only the shop's own charge is profit.
  cyber: { stock: 'Paper & Supplies', expense: ['Paper & Supplies', 'Govt Fees Paid', 'Internet Bill', 'Electricity', 'Shop Rent', 'Computer Repairs', 'Staff Salary', 'Other'], income: ['Online Application Charges', 'Govt Fees Collected', 'Printing', 'Photocopy', 'Lamination & Binding', 'Scan & Email', 'Compose & Typing', 'Photo Print', 'bKash & Flexiload Commission', 'Other Income'], products: ['A4 Paper', 'Toner & Ink', 'Lamination Sheets', 'Photo Paper', 'Binding Materials', 'Computer Accessories', 'Other goods'] },
  tailor: { stock: 'Fabric & Thread', expense: ['Fabric & Thread', 'Shop Rent', 'Electricity', 'Staff Salary', 'Machine Repairs', 'Other'], income: ['Tailoring Charges', 'Fabric Sales', 'Other Income'], products: ['Fabric', 'Thread & Buttons', 'Lace & Accessories', 'Other goods'] },
  restaurant: { stock: 'Bazar & Ingredients', expense: ['Bazar & Ingredients', 'Gas', ...RUNNING, 'Utensils & Packaging', 'Other'], income: ['Food Sales', 'Other Income'], products: ['Rice & Flour', 'Meat & Fish', 'Vegetables', 'Oil & Spices', 'Tea, Sugar & Milk', 'Drinks', 'Other goods'] },
  hardware: { stock: 'Stock Purchase', expense: ['Stock Purchase', ...RUNNING, 'Loading & Unloading', 'Other'], income: ['Sales', 'Other Income'], products: ['Cement', 'Rod & Steel', 'Paint', 'Sanitary', 'Pipes & Fittings', 'Tools', 'Other goods'] },
  salon: { stock: 'Products & Supplies', expense: ['Products & Supplies', 'Shop Rent', 'Electricity', 'Staff Salary', 'Equipment', 'Other'], income: ['Service Charges', 'Product Sales', 'Other Income'], products: ['Hair Care', 'Skin Care', 'Tools', 'Other goods'] },
  online: { stock: 'Product Purchase', expense: ['Product Purchase', 'Delivery Charge', 'Facebook Ads', 'Packaging', 'Returns', 'Mobile & Internet', 'Other'], income: ['Online Sales', 'Other Income'], products: ['Clothing', 'Cosmetics', 'Food Items', 'Gadgets', 'Handicrafts', 'Other goods'] },
  agent: { stock: 'Stock Purchase', expense: ['Shop Rent', 'Electricity', 'Staff Salary', 'Mobile & Internet', 'Other'], income: ['bKash Commission', 'Nagad Commission', 'Flexiload Commission', 'Other Income'], products: ['SIM & Scratch Cards', 'Other goods'] },
  agri: { stock: 'Farm Inputs', expense: ['Seeds', 'Fertilizer', 'Pesticide', 'Labour', 'Irrigation & Diesel', 'Land Lease', 'Equipment Rent', 'Transport', 'Other'], income: ['Crop Sales', 'Other Income'], products: ['Seeds', 'Fertilizer', 'Pesticide', 'Tools', 'Other goods'] },
  poultry: { stock: 'Farm Inputs', expense: ['Chicks', 'Feed', 'Medicine & Vaccine', 'Labour', 'Electricity', 'Litter & Equipment', 'Transport', 'Other'], income: ['Chicken Sales', 'Egg Sales', 'Manure Sales', 'Other Income'], products: ['Chicks', 'Feed', 'Medicine & Vaccine', 'Equipment', 'Other goods'] },
  fish: { stock: 'Farm Inputs', expense: ['Fish Fry', 'Feed', 'Medicine & Lime', 'Pond Lease', 'Labour', 'Electricity', 'Other'], income: ['Fish Sales', 'Other Income'], products: ['Fish Fry', 'Feed', 'Medicine & Lime', 'Nets & Equipment', 'Other goods'] },
  dairy: { stock: 'Farm Inputs', expense: ['Cattle Feed', 'Veterinary', 'Labour', 'Shed Upkeep', 'Electricity', 'Other'], income: ['Milk Sales', 'Cattle Sales', 'Other Income'], products: ['Cattle Feed', 'Veterinary', 'Equipment', 'Other goods'] },
  other: { stock: 'Stock Purchase', expense: ['Stock Purchase', ...RUNNING, 'Other'], income: ['Sales', 'Other Income'], products: ['Other goods'] },
};

export const BUSINESS_EXTRA = {
  expense: ['Stock Purchase', 'Shop Rent', 'Electricity', 'Staff Salary', 'Transport & Delivery', 'Mobile & Internet', 'Repairs', 'Licence & Fees', 'Snacks & Tea', 'Donation', 'Loan Installment', 'Other'],
  income: ['Sales', 'Service Income', 'Commission', 'Other Income'],
};

// The kinds of business offered when someone picks just "Business owner".
export const BUSINESS_TYPES = ['grocery', 'pharmacy', 'cyber', 'electronics', 'mobile', 'stationery', 'clothing', 'restaurant', 'hardware', 'agri', 'poultry', 'fish', 'dairy', 'online', 'other'];

// id, icon, English, Bangla, other words people type, and where it leads.
const P = (id, icon, en, bn, words, to) => ({ id, icon, en, bn, words, ...to });
export const PROFESSIONS = [
  P('student', '🎓', 'Student', 'শিক্ষার্থী', 'ছাত্র ছাত্রী university college school versity', { personal: 'student' }),
  P('job', '💼', 'Job holder', 'চাকরিজীবী', 'employee service office চাকরি staff officer', { personal: 'job' }),
  P('teacher', '👩‍🏫', 'Teacher', 'শিক্ষক', 'শিক্ষিকা lecturer professor master মাস্টার স্যার', { personal: 'teacher' }),
  P('tutor', '📚', 'Private tutor', 'গৃহশিক্ষক', 'tuition টিউশনি টিউটর coaching কোচিং', { personal: 'teacher' }),
  P('doctor', '🩺', 'Doctor', 'ডাক্তার', 'চিকিৎসক physician mbbs chamber', { personal: 'doctor' }),
  P('nurse', '🏥', 'Nurse', 'নার্স', 'health worker স্বাস্থ্যকর্মী', { personal: 'job' }),
  P('engineer', '🛠️', 'Engineer', 'প্রকৌশলী', 'ইঞ্জিনিয়ার', { personal: 'job' }),
  P('banker', '🏦', 'Banker', 'ব্যাংকার', 'bank job ব্যাংকে চাকরি', { personal: 'job' }),
  P('govt', '🏛️', 'Government job', 'সরকারি চাকরি', 'govt public service সরকারি', { personal: 'job' }),
  P('defence', '🎖️', 'Police / Army', 'পুলিশ / সেনাবাহিনী', 'police army navy airforce bgb আনসার', { personal: 'job' }),
  P('ngo', '🤝', 'NGO worker', 'এনজিও কর্মী', 'ngo development', { personal: 'job' }),
  P('it', '💻', 'IT professional', 'আইটি পেশাজীবী', 'software developer programmer প্রোগ্রামার', { personal: 'job' }),
  P('lawyer', '⚖️', 'Lawyer', 'আইনজীবী', 'advocate উকিল', { personal: 'lawyer' }),
  P('freelancer', '🧑‍💻', 'Freelancer', 'ফ্রিল্যান্সার', 'upwork fiverr designer ডিজাইনার content creator ইউটিউবার youtuber', { personal: 'freelancer' }),
  P('garments', '🧵', 'Garments worker', 'গার্মেন্টস কর্মী', 'factory worker কারখানা শ্রমিক rmg', { personal: 'worker' }),
  P('driver', '🛺', 'Driver (CNG, rickshaw, car)', 'চালক (সিএনজি, রিকশা, গাড়ি)', 'ড্রাইভার রিকশাওয়ালা rickshaw cng uber pathao বাইক bus বাস truck ট্রাক', { personal: 'driver' }),
  P('labour', '👷', 'Day labourer', 'দিনমজুর', 'labour শ্রমিক মজুর worker construction', { personal: 'labour' }),
  P('retired', '🧓', 'Retired', 'অবসরপ্রাপ্ত', 'pension পেনশন', { personal: 'retired' }),
  P('probashi', '✈️', 'Working abroad (Probashi)', 'প্রবাসী', 'expatriate abroad বিদেশ remittance', { personal: 'probashi' }),
  P('imam', '🕌', 'Imam / Muezzin', 'ইমাম / মুয়াজ্জিন', 'মসজিদ mosque', { personal: 'teacher' }),
  P('home', '🏠', 'Running a home', 'সংসার চালাই', 'housewife homemaker গৃহিণী মা mother', { personal: 'home' }),
  P('business', '🏪', 'Business owner', 'ব্যবসায়ী', 'business ব্যবসা owner entrepreneur উদ্যোক্তা', { business: null }),
  P('grocery', '🛒', 'Grocery shop', 'মুদি দোকান', 'mudi mudir dokan grocery general store কিরানা দোকানদার', { business: 'grocery' }),
  P('pharmacy', '💊', 'Pharmacy', 'ফার্মেসি', 'ওষুধের দোকান medicine drug store dispensary', { business: 'pharmacy' }),
  P('electronics', '🔌', 'Electronics shop', 'ইলেকট্রনিক্স দোকান', 'electric ইলেকট্রিক fan tv fridge', { business: 'electronics' }),
  P('mobile', '📱', 'Mobile phone shop', 'মোবাইলের দোকান', 'mobile servicing মোবাইল সার্ভিসিং phone', { business: 'mobile' }),
  P('cyber', '🖨️', 'Computer & photocopy shop', 'কম্পিউটার ও ফটোকপির দোকান', 'cyber cafe সাইবার ক্যাফে online service অনলাইন সেবা অনলাইন আবেদন application আবেদন print প্রিন্ট printing compose কম্পোজ typing টাইপ lamination লেমিনেটিং scan স্ক্যান passport পাসপোর্ট nid জন্মনিবন্ধন digital center ডিজিটাল সেন্টার udc কম্পিউটারের দোকান', { business: 'cyber' }),
  P('stationery', '✏️', 'Stationery & library', 'স্টেশনারি ও লাইব্রেরি', 'library লাইব্রেরি bookshop বইয়ের দোকান খাতা কলম', { business: 'stationery' }),
  P('clothing', '👗', 'Clothing shop', 'কাপড়ের দোকান', 'boutique বুটিক garments shop শাড়ি fashion', { business: 'clothing' }),
  P('tailor', '✂️', 'Tailor', 'দর্জি', 'টেইলার্স tailoring সেলাই', { business: 'tailor' }),
  P('restaurant', '🍛', 'Restaurant / tea stall', 'হোটেল / চায়ের দোকান', 'restaurant রেস্টুরেন্ট cafe tea stall চা fast food খাবার হোটেল', { business: 'restaurant' }),
  P('hardware', '🔩', 'Hardware & building materials', 'হার্ডওয়্যার ও নির্মাণসামগ্রী', 'cement সিমেন্ট rod রড sanitary paint', { business: 'hardware' }),
  P('salon', '💇', 'Salon / beauty parlour', 'সেলুন / বিউটি পার্লার', 'barber নাপিত parlour পার্লার', { business: 'salon' }),
  P('online', '🛍️', 'Online shop (F-commerce)', 'অনলাইন ব্যবসা', 'facebook page ফেসবুক পেজ ecommerce f-commerce online seller', { business: 'online' }),
  P('agent', '📲', 'bKash / Flexiload agent', 'বিকাশ / ফ্লেক্সিলোড এজেন্ট', 'agent এজেন্ট mobile banking nagad flexiload', { business: 'agent' }),
  P('agri', '🌾', 'Crop farming', 'কৃষি / চাষাবাদ', 'farmer কৃষক farm চাষি ধান rice farming', { business: 'agri' }),
  P('poultry', '🐔', 'Poultry farm', 'মুরগির খামার', 'poultry পোল্ট্রি broiler ব্রয়লার layer লেয়ার chicken', { business: 'poultry' }),
  P('fish', '🐟', 'Fish farm', 'মাছের খামার', 'pond পুকুর hatchery মৎস্য fishery', { business: 'fish' }),
  P('dairy', '🐄', 'Dairy & cattle farm', 'গরুর খামার', 'cow গরু cattle milk দুধ ডেইরি', { business: 'dairy' }),
  P('otherbiz', '🏪', 'Other business', 'অন্য ব্যবসা', '', { business: 'other' }),
];

export const POPULAR = ['student', 'job', 'freelancer', 'home', 'business'];

const norm = (s) => String(s || '').normalize('NFC').toLowerCase().trim();

// Best matches for what was typed: names first, then other words.
export function searchProfessions(query, limit = 6) {
  const q = norm(query);
  if (!q) return [];
  const scored = [];
  for (const p of PROFESSIONS) {
    const names = [p.en, p.bn].map(norm);
    const words = [...names.join(' ').split(/[\s/(),]+/), ...norm(p.words).split(/\s+/)].filter(Boolean);
    const typed = q.split(/\s+/);
    let score = 0;
    if (names.some((n) => n.startsWith(q))) score = 3;
    else if (names.some((n) => n.includes(q))) score = 2;
    // Every typed word starts one of its words: "garments factory", "fish pond".
    else if (typed.every((tw) => words.some((w) => w.startsWith(tw) || (w.length > 4 && tw.startsWith(w))))) score = 1;
    if (score) scored.push([score, p]);
  }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map(([, p]) => p);
}

export const professionById = (id) => PROFESSIONS.find((p) => p.id === id);

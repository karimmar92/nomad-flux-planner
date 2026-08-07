/**
 * Phrase data.
 *
 * STATUS: translations below are DRAFTS pending native-speaker review, and
 * every locale therefore has `verifiedBy: null`, which makes the UI label them
 * as unverified. Do not flip that field until a named person has checked the
 * set. The claim "verified by a native speaker" is the whole reason this
 * feature is better than a translator, and it is a claim you can be held to.
 *
 * Selection rule for adding phrases: include a sentence only if getting it
 * wrong has a real cost — a refused entry, a lost deposit, a wrong medicine.
 * "Where is the beach" belongs in a travel app, not in this one.
 */
import type { PhrasebookLocale } from "./types";

const VIETNAM: PhrasebookLocale = {
  countryCode: "VN",
  country: "Vietnam",
  languageName: "Vietnamese",
  bcp47: "vi-VN",
  verifiedBy: null,
  verifiedOn: null,
  phrases: [
    {
      id: "vn-imm-1",
      situation: "immigration",
      en: "I am here as a tourist.",
      target: "Tôi đến đây với tư cách khách du lịch.",
      pronunciation: "toy den day voy tu kak khak zu lik",
    },
    {
      id: "vn-imm-2",
      situation: "immigration",
      en: "I am staying for 30 days.",
      target: "Tôi sẽ ở lại 30 ngày.",
      pronunciation: "toy se er lai ba muoi ngay",
    },
    {
      id: "vn-imm-3",
      situation: "immigration",
      en: "This is my return ticket.",
      target: "Đây là vé máy bay khứ hồi của tôi.",
      pronunciation: "day la ve may bay khu hoy kua toy",
      note: "Airlines and officers may ask for onward travel before boarding, not only on arrival.",
    },
    {
      id: "vn-imm-4",
      situation: "immigration",
      en: "This is my e-visa approval letter.",
      target: "Đây là thư chấp thuận thị thực điện tử của tôi.",
      note: "Carry a printed copy — a phone with no battery is the common failure.",
    },
    {
      id: "vn-visa-1",
      situation: "visa_office",
      en: "I would like to extend my visa.",
      target: "Tôi muốn gia hạn thị thực.",
      pronunciation: "toy muon zaa han ti tuk",
    },
    {
      id: "vn-visa-2",
      situation: "visa_office",
      en: "Which documents are missing?",
      target: "Tôi còn thiếu giấy tờ nào?",
      likelyReplies: [
        { target: "Hộ chiếu", en: "Passport" },
        { target: "Ảnh thẻ", en: "Passport photo" },
        { target: "Đơn xin", en: "Application form" },
      ],
    },
    {
      id: "vn-visa-3",
      situation: "visa_office",
      en: "How many days will it take?",
      target: "Mất bao nhiêu ngày ạ?",
    },
    {
      id: "vn-police-1",
      situation: "police",
      en: "My passport was stolen. I need a police report.",
      target: "Hộ chiếu của tôi bị mất cắp. Tôi cần biên bản của công an.",
      note: "An embassy will not issue an emergency passport without this report.",
    },
    {
      id: "vn-pharm-1",
      situation: "pharmacy",
      en: "I need something for a fever.",
      target: "Tôi cần thuốc hạ sốt.",
      pronunciation: "toy kan thuok ha sot",
    },
    {
      id: "vn-pharm-2",
      situation: "pharmacy",
      en: "I am allergic to penicillin.",
      target: "Tôi bị dị ứng với penicillin.",
    },
    {
      id: "vn-house-1",
      situation: "housing",
      en: "Are electricity and water included?",
      target: "Giá đã bao gồm điện nước chưa?",
      note: "Landlords often charge a higher per-unit rate for electricity than the state rate. Ask the rate, not just whether it is included.",
    },
    {
      id: "vn-house-2",
      situation: "housing",
      en: "How much is the deposit, and when is it returned?",
      target: "Tiền đặt cọc là bao nhiêu và khi nào được trả lại?",
    },
    {
      id: "vn-house-3",
      situation: "housing",
      en: "Will you register my temporary residence?",
      target: "Anh/chị có đăng ký tạm trú cho tôi không?",
      note: "Temporary residence registration is a legal requirement for foreigners in Vietnam and is normally the landlord's task.",
    },
    {
      id: "vn-bank-1",
      situation: "bank",
      en: "I would like to open an account. What documents do I need?",
      target: "Tôi muốn mở tài khoản. Tôi cần những giấy tờ gì?",
    },
    {
      id: "vn-sim-1",
      situation: "sim_card",
      en: "I would like a SIM card with data, registered in my name.",
      target: "Tôi muốn mua sim có dữ liệu, đăng ký bằng tên tôi.",
      note: "Vietnamese SIMs must be registered to a passport. An unregistered SIM can be cut off without warning.",
    },
    {
      id: "vn-emg-1",
      situation: "emergency",
      en: "I need a doctor.",
      target: "Tôi cần bác sĩ.",
      pronunciation: "toy kan bak si",
    },
    {
      id: "vn-emg-2",
      situation: "emergency",
      en: "Please call an ambulance.",
      target: "Làm ơn gọi xe cấp cứu.",
      note: "Ambulance 115, police 113, fire 114.",
    },
  ],
};

const THAILAND: PhrasebookLocale = {
  countryCode: "TH",
  country: "Thailand",
  languageName: "Thai",
  bcp47: "th-TH",
  verifiedBy: null,
  verifiedOn: null,
  phrases: [
    {
      id: "th-imm-1",
      situation: "immigration",
      en: "I am here as a tourist.",
      target: "ผม/ดิฉันมาเที่ยวครับ/ค่ะ",
      pronunciation: "phom/dichan maa thiao khrap/kha",
      note: "Men say ผม / ครับ, women ดิฉัน / ค่ะ. Using the wrong one is understood but marks you as a beginner.",
    },
    {
      id: "th-imm-2",
      situation: "immigration",
      en: "This is my onward ticket.",
      target: "นี่คือตั๋วเดินทางออกนอกประเทศของผม/ดิฉัน",
    },
    {
      id: "th-visa-1",
      situation: "visa_office",
      en: "I would like to extend my stay.",
      target: "ผม/ดิฉันต้องการขอขยายเวลาพำนัก",
      note: "Extensions are handled at an Immigration Office, and the TM.7 form plus a photo are normally required.",
    },
    {
      id: "th-visa-2",
      situation: "visa_office",
      en: "Which documents are missing?",
      target: "ยังขาดเอกสารอะไรบ้างครับ/คะ",
    },
    {
      id: "th-police-1",
      situation: "police",
      en: "My passport was stolen. I need a police report.",
      target: "หนังสือเดินทางของผม/ดิฉันถูกขโมย ต้องการใบแจ้งความ",
    },
    {
      id: "th-pharm-1",
      situation: "pharmacy",
      en: "I need something for a fever.",
      target: "ขอยาลดไข้ครับ/ค่ะ",
      pronunciation: "khor yaa lot khai khrap/kha",
    },
    {
      id: "th-house-1",
      situation: "housing",
      en: "Are electricity and water included?",
      target: "ค่าไฟค่าน้ำรวมอยู่ในค่าเช่าไหมครับ/คะ",
    },
    {
      id: "th-emg-1",
      situation: "emergency",
      en: "Please call an ambulance.",
      target: "ช่วยเรียกรถพยาบาลด้วยครับ/ค่ะ",
      note: "Emergency medical 1669, tourist police 1155.",
    },
  ],
};

const PORTUGAL: PhrasebookLocale = {
  countryCode: "PT",
  country: "Portugal",
  languageName: "Portuguese",
  bcp47: "pt-PT",
  verifiedBy: null,
  verifiedOn: null,
  phrases: [
    {
      id: "pt-imm-1",
      situation: "immigration",
      en: "I am entering as a tourist under the Schengen 90/180 rule.",
      target: "Entro como turista ao abrigo da regra Schengen de 90 dias em 180.",
    },
    {
      id: "pt-visa-1",
      situation: "visa_office",
      en: "I have an appointment about my residence permit.",
      target: "Tenho uma marcação sobre a minha autorização de residência.",
    },
    {
      id: "pt-visa-2",
      situation: "visa_office",
      en: "Which documents are missing?",
      target: "Que documentos faltam?",
    },
    {
      id: "pt-bank-1",
      situation: "bank",
      en: "I would like to open an account. I have a NIF.",
      target: "Gostaria de abrir uma conta. Tenho NIF.",
      note: "A NIF (tax number) is needed for almost everything in Portugal, including a phone contract and a lease.",
    },
    {
      id: "pt-house-1",
      situation: "housing",
      en: "Are water, electricity and internet included?",
      target: "A água, a eletricidade e a internet estão incluídas?",
    },
    {
      id: "pt-house-2",
      situation: "housing",
      en: "How many months of deposit are required?",
      target: "Quantos meses de caução são necessários?",
    },
    {
      id: "pt-pharm-1",
      situation: "pharmacy",
      en: "I am allergic to penicillin.",
      target: "Sou alérgico/alérgica à penicilina.",
    },
    {
      id: "pt-emg-1",
      situation: "emergency",
      en: "Please call an ambulance.",
      target: "Por favor, chame uma ambulância.",
      note: "Emergency number 112 across the EU.",
    },
  ],
};

export const PHRASEBOOKS: PhrasebookLocale[] = [VIETNAM, THAILAND, PORTUGAL];

export function phrasebookFor(countryCode: string): PhrasebookLocale | undefined {
  return PHRASEBOOKS.find((p) => p.countryCode === countryCode.toUpperCase());
}

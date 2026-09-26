// Versioned reference snapshot; activation still requires authoritative database compatibility checks.
export const PROPERTY_PROFILES=[
  {
    "code": "residential_condominium",
    "labels": {
      "en": "Residential Condominium",
      "ro": "Condominiu rezidențial",
      "fa": "مجتمع آپارتمانی مسکونی"
    }
  },
  {
    "code": "residential_complex",
    "labels": {
      "en": "Residential Complex",
      "ro": "Complex rezidențial",
      "fa": "شهرک یا مجتمع بزرگ مسکونی"
    }
  },
  {
    "code": "gated_villa_community",
    "labels": {
      "en": "Gated Villa Community",
      "ro": "Ansamblu rezidențial de vile",
      "fa": "شهرک ویلایی محصور"
    }
  },
  {
    "code": "single_villa",
    "labels": {
      "en": "Single Villa",
      "ro": "Vilă individuală",
      "fa": "ویلای مستقل"
    }
  },
  {
    "code": "small_landlord_portfolio",
    "labels": {
      "en": "Small Landlord Portfolio",
      "ro": "Portofoliu proprietar individual",
      "fa": "پورتفولیوی مالک خرد"
    }
  },
  {
    "code": "mixed_use_estate",
    "labels": {
      "en": "Mixed-Use Estate",
      "ro": "Complex cu funcțiuni mixte",
      "fa": "مجتمع چندمنظوره / تجاری مسکونی"
    }
  },
  {
    "code": "retail_centre",
    "labels": {
      "en": "Retail Centre",
      "ro": "Centru comercial / Mall",
      "fa": "مرکز تجاری و فروشگاهی"
    }
  },
  {
    "code": "office_centre",
    "labels": {
      "en": "Office Centre",
      "ro": "Centru de birouri",
      "fa": "مجتمع اداری"
    }
  },
  {
    "code": "warehouse_logistics",
    "labels": {
      "en": "Warehouse & Logistics Centre",
      "ro": "Centru logistic și depozite",
      "fa": "مرکز لجستیک و انبارداری"
    }
  },
  {
    "code": "managed_township",
    "labels": {
      "en": "Managed Township",
      "ro": "District administrat / Township",
      "fa": "شهرک شهری مدیریت‌شده"
    }
  },
  {
    "code": "industrial_park",
    "labels": {
      "en": "Industrial Park",
      "ro": "Parc industrial",
      "fa": "پارک / منطقه صنعتی"
    }
  },
  {
    "code": "serviced_residence",
    "labels": {
      "en": "Serviced Residence",
      "ro": "Reședință cu servicii incluse",
      "fa": "اقامتگاه مبله / هتلی"
    }
  },
  {
    "code": "standalone_parking",
    "labels": {
      "en": "Standalone Parking Facility",
      "ro": "Parcare autonomă administrată",
      "fa": "پارکینگ طبقاتی یا مستقل"
    }
  },
  {
    "code": "shared_facility",
    "labels": {
      "en": "Shared Facility",
      "ro": "Facilitate comună administrată",
      "fa": "مرکز خدمات و امکانات مشترک"
    }
  },
  {
    "code": "developer_portfolio",
    "labels": {
      "en": "Developer Portfolio",
      "ro": "Portofoliu dezvoltator",
      "fa": "پورتفولیوی توسعه‌دهنده"
    }
  },
  {
    "code": "third_party_management_portfolio",
    "labels": {
      "en": "Third-Party Management Portfolio",
      "ro": "Portofoliu administrare terță",
      "fa": "پورتفولیوی مدیریت قراردادهای ثالث"
    }
  }
] as const;
export const OPERATING_MODELS=[
  {
    "code": "association_managed",
    "labels": {
      "en": "Owners Association Managed",
      "ro": "Administrare prin Asociație de Proprietari",
      "fa": "مدیریت هیئت مدیره / انجمن مالکان"
    }
  },
  {
    "code": "single_owner_operated",
    "labels": {
      "en": "Single Owner Operated",
      "ro": "Operat de proprietar unic",
      "fa": "بهره‌برداری توسط تک مالک"
    }
  },
  {
    "code": "developer_operated",
    "labels": {
      "en": "Developer Operated",
      "ro": "Operat de dezvoltator",
      "fa": "بهره‌برداری مستقیم توسعه‌دهنده"
    }
  },
  {
    "code": "third_party_managed",
    "labels": {
      "en": "Third-Party Contract Managed",
      "ro": "Administrare prin companie de property management",
      "fa": "مدیریت پیمانکاری توسط شرکت مدیریت ملک"
    }
  },
  {
    "code": "master_lease",
    "labels": {
      "en": "Master Lease & Operated",
      "ro": "Închiriere generală și operare",
      "fa": "اجاره کل و بهره‌برداری تجاری"
    }
  },
  {
    "code": "multi_owner_contractual",
    "labels": {
      "en": "Multi-Owner Contractual Governance",
      "ro": "Guvernanță contractuală între co-proprietari",
      "fa": "مدیریت قراردادی میان چند مالک"
    }
  },
  {
    "code": "institutional_owner",
    "labels": {
      "en": "Institutional / Fund Owner Operated",
      "ro": "Proprietar instituțional / Fond de investiții",
      "fa": "مالکیت نهادی و صندوق سرمایه‌گذاری"
    }
  },
  {
    "code": "mixed_authority",
    "labels": {
      "en": "Mixed Authority Management",
      "ro": "Administrare cu autoritate mixtă",
      "fa": "مدیریت با ساختار اختیارات ترکیبی"
    }
  }
] as const;

export const PROFILE_MODEL_COMPATIBILITY:Record<string,string>={
  "residential_condominium:association_managed": "compatible",
  "residential_condominium:third_party_managed": "compatible",
  "residential_condominium:developer_operated": "review_required",
  "residential_condominium:multi_owner_contractual": "review_required",
  "residential_complex:association_managed": "compatible",
  "residential_complex:third_party_managed": "compatible",
  "residential_complex:mixed_authority": "compatible",
  "residential_complex:developer_operated": "review_required",
  "residential_complex:multi_owner_contractual": "review_required",
  "gated_villa_community:association_managed": "compatible",
  "gated_villa_community:third_party_managed": "compatible",
  "gated_villa_community:multi_owner_contractual": "compatible",
  "gated_villa_community:developer_operated": "review_required",
  "single_villa:single_owner_operated": "compatible",
  "single_villa:third_party_managed": "compatible",
  "single_villa:master_lease": "compatible",
  "small_landlord_portfolio:single_owner_operated": "compatible",
  "small_landlord_portfolio:third_party_managed": "compatible",
  "small_landlord_portfolio:master_lease": "compatible",
  "mixed_use_estate:mixed_authority": "compatible",
  "mixed_use_estate:third_party_managed": "compatible",
  "mixed_use_estate:institutional_owner": "compatible",
  "mixed_use_estate:association_managed": "review_required",
  "mixed_use_estate:developer_operated": "review_required",
  "mixed_use_estate:multi_owner_contractual": "review_required",
  "retail_centre:single_owner_operated": "compatible",
  "retail_centre:third_party_managed": "compatible",
  "retail_centre:institutional_owner": "compatible",
  "retail_centre:master_lease": "compatible",
  "retail_centre:developer_operated": "review_required",
  "office_centre:single_owner_operated": "compatible",
  "office_centre:third_party_managed": "compatible",
  "office_centre:institutional_owner": "compatible",
  "office_centre:master_lease": "compatible",
  "office_centre:developer_operated": "review_required",
  "warehouse_logistics:single_owner_operated": "compatible",
  "warehouse_logistics:third_party_managed": "compatible",
  "warehouse_logistics:institutional_owner": "compatible",
  "warehouse_logistics:master_lease": "compatible",
  "managed_township:mixed_authority": "compatible",
  "managed_township:third_party_managed": "compatible",
  "managed_township:developer_operated": "compatible",
  "managed_township:institutional_owner": "compatible",
  "industrial_park:single_owner_operated": "compatible",
  "industrial_park:third_party_managed": "compatible",
  "industrial_park:institutional_owner": "compatible",
  "industrial_park:mixed_authority": "compatible",
  "serviced_residence:single_owner_operated": "compatible",
  "serviced_residence:third_party_managed": "compatible",
  "serviced_residence:master_lease": "compatible",
  "serviced_residence:institutional_owner": "compatible",
  "serviced_residence:developer_operated": "review_required",
  "standalone_parking:single_owner_operated": "compatible",
  "standalone_parking:third_party_managed": "compatible",
  "standalone_parking:master_lease": "compatible",
  "standalone_parking:mixed_authority": "compatible",
  "shared_facility:third_party_managed": "compatible",
  "shared_facility:single_owner_operated": "compatible",
  "shared_facility:mixed_authority": "compatible",
  "shared_facility:association_managed": "review_required",
  "developer_portfolio:developer_operated": "compatible",
  "developer_portfolio:third_party_managed": "compatible",
  "third_party_management_portfolio:third_party_managed": "compatible",
  "third_party_management_portfolio:mixed_authority": "compatible"
};

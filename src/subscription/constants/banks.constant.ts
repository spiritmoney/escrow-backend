const BANKS = {
  banks: [
    {
      name: "Access Bank",
      code: "044"
    },
    {
      name: "First Bank of Nigeria",
      code: "011"
    },
    {
      name: "Guaranty Trust Bank",
      code: "058"
    },
    {
      name: "United Bank for Africa",
      code: "033"
    },
    {
      name: "Zenith Bank",
      code: "057"
    },
    {
      name: "Sterling Bank",
      code: "232"
    },
    {
      name: "Ecobank Nigeria",
      code: "050"
    },
    {
      name: "Fidelity Bank",
      code: "070"
    },
    {
      name: "Union Bank of Nigeria",
      code: "032"
    },
    {
      name: "Wema Bank",
      code: "035"
    },
    {
      name: "Kuda",
      code: "KD"
    },
    {
      name: "Opay",
      code: "C03"
    }
  ]
};

export const SUPPORTED_BANKS = BANKS.banks.map(bank => ({
  name: bank.name,
  code: bank.code
}));

export const BANK_NAMES = SUPPORTED_BANKS.map(bank => bank.name); 
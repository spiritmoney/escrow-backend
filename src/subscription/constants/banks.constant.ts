import banks from '../../../banks.json'

export const SUPPORTED_BANKS = banks.banks.map(bank => ({
  name: bank.name,
  code: bank.code
}));

export const BANK_NAMES = SUPPORTED_BANKS.map(bank => bank.name); 
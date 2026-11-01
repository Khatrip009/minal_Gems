const ONES = [
  '',
  'One',
  'Two',
  'Three',
  'Four',
  'Five',
  'Six',
  'Seven',
  'Eight',
  'Nine',
  'Ten',
  'Eleven',
  'Twelve',
  'Thirteen',
  'Fourteen',
  'Fifteen',
  'Sixteen',
  'Seventeen',
  'Eighteen',
  'Nineteen',
]
const TENS = [
  '',
  '',
  'Twenty',
  'Thirty',
  'Forty',
  'Fifty',
  'Sixty',
  'Seventy',
  'Eighty',
  'Ninety',
]

function twoDigits(n: number): string {
  if (n < 20) return ONES[n]
  const tens = Math.floor(n / 10)
  const ones = n % 10
  return TENS[tens] + (ones ? ' ' + ONES[ones] : '')
}

function threeDigits(n: number): string {
  if (n < 100) return twoDigits(n)
  const hundreds = Math.floor(n / 100)
  const rest = n % 100
  return (
    ONES[hundreds] +
    ' Hundred' +
    (rest ? ' ' + twoDigits(rest) : '')
  )
}

function integerToWords(num: number): string {
  if (num === 0) return 'Zero'
  if (num < 0) return 'Minus ' + integerToWords(-num)

  const crore = Math.floor(num / 10000000)
  num = num % 10000000
  const lakh = Math.floor(num / 100000)
  num = num % 100000
  const thousand = Math.floor(num / 1000)
  num = num % 1000

  const parts: string[] = []
  if (crore) parts.push(integerToWords(crore) + ' Crore')
  if (lakh) parts.push(twoDigits(lakh) + ' Lakh')
  if (thousand) parts.push(twoDigits(thousand) + ' Thousand')
  if (num) parts.push(threeDigits(num))

  return parts.join(' ').trim()
}

export function amountInWords(amount: number): string {
  const rupees = Math.floor(amount)
  const paise = Math.round((amount - rupees) * 100)
  const rupeeWords = integerToWords(rupees)
  const paiseWords = paise > 0 ? ` and Paise ${integerToWords(paise)}` : ''
  return `Rupees ${rupeeWords}${paiseWords} Only`
}
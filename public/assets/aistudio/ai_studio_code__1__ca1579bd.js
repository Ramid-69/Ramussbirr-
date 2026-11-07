// ገንዘብ በተሳካ ሁኔታ ሲተላለፍ ይህንን ተግባራዊ ያድርጉ:
await fetch('https://ms-bk-connect.vercel.app/api/sms/webhook', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': 'Ram69',
  },
  body: JSON.stringify({
    senderName: 'CBEBirr', // ወይም 'telebirr', '127', 'CBE'
    text: transactionSmsText, // ልክ እንደተጻፈው ምንም ሳይቀየር የሚሄደው ጽሁፍ
    amount: amount,
    recipient: receiverName,
    recipientAccount: receiverAccount,
    balance: currentBalance,
    reference: txnId,
    deviceId: 'all',
  }),
});
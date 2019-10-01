// ToDo:
// - Need to know how much money hodled over what time frames to calc strategy comparisons
//   - ie: vs btc hodl, not staking, optimal staking est., etc
// - Confirm there are no other ways a ticket resolves besides Vote or Revoke.
// - Checking if reward is enough to buy a ticket doesn't work for multiples above 1 extra ticket
// - Add disclaimers for ROI section explaining assumptions.
// - Hitting enter on input also triggers search, not just clicking submit

// ==== Global variables ==== //
let currentAddr = '';
const maxCheck = 8000; // The api doesn't return more than 8000 results

// ==== Event Handlers ==== //
$('.example-button').on('click', e => {
  let ticketAddress = $(e.target).attr('data-addr');
  currentAddr = ticketAddress;
  fetchJSON(ticketAddress);
})

$('#input-button').on('click', () => {
  let ticketAddress = $("#dcr-addr").val().trim();
  currentAddr = ticketAddress;
  fetchJSON(ticketAddress);
});

// ==== Helper Functions ==== //
function round(number, precision) {
  if (!precision) {
    // Default is 4 decimal places if not specified
    precision = 4;
  }
  x = Math.pow(10, precision);
  return Math.trunc(number*x)/x
}

// ==== Ajax request ==== //
function fetchJSON(addr) {
  const url = `https://explorer.dcrdata.org/api/address/${addr}/count/${maxCheck}/raw`;
  const request = {
    method: 'GET',
    url: url,
    dataType: 'json',
    error: handleError,
    beforeSend: handleSubmit,
    success: handleSuccess,
  }
  $.ajax(request);
}

function handleError(error) {
  console.log({error});
}

function handleSubmit() {
  // This function runs right when ajax starts, before results come bac,
  // un-hide if hidden, replace values with loading placeholder
  $('main').removeClass('hidden');
  $('.result').text('[loading...]');
  // clear out link, hide till results (done in the populateHtml function)
  $("a#explore-link").prop("href", "").addClass('hidden')
}

function handleSuccess(response) {
  // The function runs if the ajax results come back with a success response type

  // Steps:
  // 1) Check the ticket's time (epoch format). Find the oldest and newest ticket. Calc time elapsed.
  // 2) Check the ticket type (buy, vote, or revoke) and count them up
  // Votes: is the first input a stake base? Votes have that for the new coins created
  // Buys: is the first output a stake submission? Buys have that for the ticket payment
  // Revokes: is the first output a stake revoke? Revoked tickets are returned without reward
  // 3) Count up all the Vote type reward payouts (stakegen and refunds)
  // 4) Add up all the buy costs and all the resolve (vote or revoke) refunds. Diff is the amount currently still staked.
  // 5) Estimate roi and average ticket price

  let info = {
    dcrReward: 0,
    totalBuys: 0,
    totalVotes: 0,
    totalRevokes: 0, // Tickets that resolve without a vote or reward
    totalBuyCost: 0,
    totalResolveRefund: 0, // Ticket price unlocked at resolution
    runningBalance: 0, // Current buy - refund amount
    maxBalance: 0, // max value that was ever staked at once
    oldestTime: response[response.length-1].time,
    newestTime: response[0].time,
    daysSince: 0,
    daysBetween: 0,
  }

  // Calc dates  
  let currentTime = new Date(Date.now()/1000);
  let newTime = new Date(info.newestTime)
  let oldTime = new Date(info.oldestTime);
  info.daysSince = (currentTime - oldTime)/60/60/24;
  info.daysBetween = (newTime - oldTime)/60/60/24;

  // response is an array of transactions. Loop in reverse, oldest to newest
  response.reverse().forEach(ticket => {
    // Check ticket type
    if (ticket.vout[0].scriptPubKey.type === 'stakesubmission') {
      // Ticket type is 'Buy' (a new ticket)
      info.totalBuys++
      // Add up the buy costs
      info.totalBuyCost += ticket.vout[0].value;
      info.runningBalance +=  ticket.vout[0].value;
      if (info.maxBalance < info.runningBalance ) {
        info.maxBalance = info.runningBalance;
      }
    } else if (ticket.vin[0].hasOwnProperty('stakebase')) {
      // Ticket type is 'Vote' (a ticket resolution that voted. Gets a reward and ticket price refund)
      info.totalVotes++
      // Each vote has a reward payout in the first input. Lets add them all up
      info.dcrReward += ticket.vin[0].amountin;
      // Add up the refunded ticket price
      info.totalResolveRefund += ticket.vin[1].amountin;
      info.runningBalance -=  ticket.vin[1].amountin;
    } else if (ticket.vout[0].scriptPubKey.type === 'stakerevoke') {
      // Ticket type is 'Revoke' (a ticket resolution that failed to vote. No reward, but still refunded)
      info.totalRevokes++
      // Add up the refunded ticket price
      info.totalResolveRefund += ticket.vin[0].amountin;
      info.runningBalance -=  ticket.vin[0].amountin;
    } else {
      // None of the above. Error: Unrecognized ticket type.
      console.log('Error: Unrecognized ticket type detected. Stats maybe be incorrect. Offending ticket details: ', ticket)
    }
  })
  console.log(info);
  if ((info.totalBuys + info.totalVotes + info.totalRevokes) >= maxCheck) {
    // Did the number of transactions potentially exceed the json results?
    console.log(`Error: Tickets maxed out. This only works when there are less than ${maxCheck} ticket transactions. Stats maybe be incorrect.`)
  }
  populateHtml(info);
}

function populateHtml(info) {
  // clear out current info
  $('.result').text('...');
  // add link and un-hide
  $("a#explore-link").prop("href", `https://explorer.dcrdata.org/address/${currentAddr}`).removeClass('hidden')
  // grab id's and add in new info
  $('#ticket-addr').text(currentAddr)
  $('#num-txn').text(info.totalBuys + info.totalVotes + info.totalRevokes)
  $('#max-checked').text(maxCheck)
  $('#days-hours-old').text(`${Math.trunc(info.daysSince)} days ${Math.round((info.daysSince%1)*24)} hours`)
  $('#oldest-date').text(new Date(info.oldestTime*1000))
  $('#days-hours-active').text(`${Math.trunc(info.daysBetween)} days ${Math.round((info.daysBetween%1)*24)} hours`)
  $('#newest-date').text(new Date(info.newestTime*1000))
  $('#currently-staking').text(round(round(info.runningBalance)))
  $('#active-tickets').text(info.totalBuys - (info.totalVotes + info.totalRevokes))
  $('#total-reward').text(round(info.dcrReward))  
  $('#daily-reward').text(round(info.dcrReward/info.daysBetween))  
  // ROI = (Current Value of Investment - Cost of Investment) / Cost of Investment
  // In a ROI calculation you need to know the total cost of the investment and the end value.
  // There is an issue determining the total cost of the investment when refunded money is reused to buy new tickets.
  // One ticket bought over and over, or a lot of tickets bought at once? Bought with reused money vs total value used to buy tickets.
  // Ticket address tracks ticket activity. Tracking a wallet's balance would involve revealing a public address seed or a lot of other guess work.
  // Solution used: For accounts where a set amount is being invested without major change, an estimate can be made.
  // Look for the max staked balance held at a single time (max concurrent ticket value) to guess total funds the wallet had access to at once.
  // This doesn't work if wallet's balance changes a lot over time, and stake rewards can also increase the wallet's investable balance.
  // Can get the average ticket price and see if the reward is enough to buy more tickets. If so, remove them from the assumed total cost of investment.
  let avgTicketPrice = info.totalBuyCost / info.totalBuys;
  if (info.dcrReward > avgTicketPrice) {
    // ToDo: what if the difference is multiple tickets worth? This only takes 1 ticket off
    info.maxBalance -= avgTicketPrice;
  }
  let estRoi = info.dcrReward/info.maxBalance;
  $('#estimated-roi').text(`${round((estRoi)*100, 2)}%`)
  // Annualized ROI = [(1+ROI)^1/n −1] × 100%
  // where n = Number of years for which the investment is held
  let n = info.daysBetween / 365
  let annRoi = (Math.pow((1+(estRoi)),(1/n))-1)
  $('#est-annual-roi').text(`${round((annRoi)*100, 2)}%`)
}
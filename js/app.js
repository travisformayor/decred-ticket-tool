// ==== Global variables ==== //
let currentAddr = '';
const maxCheck = 8000 // The api doesn't return more than 8000 results

// ==== Event Handlers ==== //
$('.example-button').on('click', e => {
  let ticketAddress = $(e.target).attr('data-addr');
  currentAddr = ticketAddress;
  fetchJSON(ticketAddress)
  stuffToDo(ticketAddress)
})

$('#input-button').on('click', () => {
  let ticketAddress = $("#dcr-addr").val().trim();
  currentAddr = ticketAddress;
  fetchJSON(ticketAddress);
  stuffToDo(ticketAddress);
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
  // when ajax starts
  // un-hide if hidden, replace values with loading placeholder
  $('main').removeClass('hidden');
  $('.result').text('[loading...]');
  // clear out link, hide till results
  $("a#explore-link").prop("href", "").addClass('hidden')
}

function handleSuccess(response) {
  // Tasks:
  // - get all votes and their stakegen (reward payout)
  // - grab all the ticket prices?
  // - count up all the ticket buys that are still active (un-voted)
  //   - the difference between total ticket buys and votes plus revokes
  // - need to know how much money hodled over what time frames to calc strategy comparisons
  //   - ie: vs btc hodl, not staking, optimal staking est., etc
  // - if there are no active tickets or no stake, its not an active account. make sure not dividing by zero.
  // ToDo: confirm there are no other ways a ticket resolves besides Vote or Revoke.
  // ToDo: use latest ticket and oldest ticket for duration roi vs only current date option

  // Steps:
  // 1) Check the ticket's time (epoch format). Find the oldest and newest ticket. Calc time elapsed.
  // 2) Check the ticket type (buy, vote, or revoke) and count them up
  // Votes: is the first input a stake base? Votes have that for the new coins created
  // Buys: is the first output a stake submission? Buys have that for the ticket payment
  // Revokes: is the first output a stake revoke? Revoked tickets are returned without reward
  // 3) Count up all the Vote type reward payouts
  // 4) Add up all the buy costs and all the resolve (vote or revoke) refunds. Diff is the amount currently still staked.

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
  // ROI = (Current Value of Investment - Cost of Investment) / Cost of Investment
  // In a ROI calculation you need to know the total cost of the investment and the end value.
  // There is an issue determining the total cost of the investment when refunded money is reused to buy new tickets.
  // Were the tickets bought at once, or was the same money reused and its roi increased? Was a ticket bought with refunded money.
  // The ticket address only tracks ticket activity, and tracking a wallet's balance would involve revealing a public address seed.
  // However, a rough estimate can be performed by looking for the max staked balance that was ever held at a single time.
  // The max total funds the wallet had access to at once would not include reused money.
  // This rough calc won't work if the wallet's balance was changing over time due to external adding.
  // It also is effected by reward money, as it increases the wallet's investable balance... but only if it's enough to buy a whole new ticket.
  // We can track the average ticket price and see if the total reward is enough to buy a new ticket. 
  // If it is, assume it was used and subtract the average ticket price from the cost of the investment (the all time high invested at once)
  let avgTicketPrice = info.totalBuyCost / info.totalBuys;
  if (info.dcrReward > avgTicketPrice) {
    info.maxBalance -= avgTicketPrice;
  }
  //Annualized ROI = [(1+ROI)^1/n −1] × 100%
  // where n = Number of years for which the investment is held
  let estRoi = info.dcrReward/info.maxBalance;
  let n = info.daysBetween / 365
  let annRoi = (Math.pow((1+(info.dcrReward/info.maxBalance)),(1/n))-1)
  $('#estimated-roi').text(`${round((estRoi)*100, 2)}%`)
  $('#annualized-roi').text(`${round((annRoi)*100, 2)}%`)
  // debugger;

  $('#avg-daily-reward').text()
  $('#avg-daily-roi').text()
  $('#est-annual-reward').text()
  $('#est-annual-roi').text()
}

function stuffToDo(addr) {
  var ticketAddress = addr;
  var maxCheck = "8000" // The api doesn't return more than 8000 results
  var decredTicketAPI = "https://explorer.dcrdata.org/api/address/"+ticketAddress+"/count/"+maxCheck+"/raw";
  $.getJSON(decredTicketAPI, function (ticketData) {
    var staking = 0;
    var tickets = 0;
    var earned = 0;
    var oldestBlock = 0;

    for (let i=0; i<ticketData.length;++i) {
      var vin = 1;
      if (ticketData[i].vin.hasOwnProperty("1")) { 
        vin = 1; 
      } else { 
        vin = 0; 
      };

      // Find oldest block on ticket address
      if (oldestBlock == 0) {
        oldestBlock = ticketData[i].vin[vin].blockheight
      };
      if (oldestBlock > ticketData[i].vin[vin].blockheight) {
        oldestBlock = ticketData[i].vin[vin].blockheight
      };

      // add up all unspent and subtract all spent
      if (ticketData[i].vout[0].scriptPubKey.type == "stakesubmission") { 
        staking += ticketData[i].vout[0].value;
        tickets += 1;
      } else {
        staking -= ticketData[i].vin[vin].amountin;
        tickets -= 1;
      };

      // add up all stakebase rewards
      if (ticketData[i].vin[0].stakebase == 0000) {
        earned = earned + ticketData[i].vin[0].amountin;
      };
      currentRoi = Math.round((earned/(staking-earned)*100)*100)/100+" %";
    };

    var blockTime;
    var decredBlockAPI = "https://explorer.dcrdata.org/api/block/"+oldestBlock;
    $.getJSON(decredBlockAPI, function (blockData) {
      blockTime = blockData.time;
      currentTime = Date.now() / 1000;
      elapsedTime = currentTime - blockTime; // in seconds
      elapsedDaysRaw = elapsedTime/60/60/24;
      elapsedWholeDays= Math.trunc(elapsedTime/60/60/24);
      extraHours = Math.round((elapsedDaysRaw - elapsedWholeDays)*24);

      // estimated returns
      avgDailyEarn = earned / elapsedDaysRaw;
      avgDailyRoi = Math.round((avgDailyEarn/(staking-earned)*100)*1000)/1000+" %";
      estAnnualEarn = avgDailyEarn * 365;
      estAnnualRoi = Math.round((estAnnualEarn/(staking-earned)*100)*100)/100+" %";

      let infoHash = {
        txn_number: ticketData.length, 
        total_staking: Math.round(staking*100)/100, 
        total_earned: Math.round(earned*100)/100, 
        current_roi: currentRoi,
        avg_daily_earn: Math.round(avgDailyEarn*100)/100,
        avg_daily_roi: avgDailyRoi,
        est_annual_earn: Math.round(estAnnualEarn*100)/100,
        est_annual_roi: estAnnualRoi,
        url: "https://explorer.dcrdata.org/address/"+ticketAddress,
        ticket_address: ticketAddress,
        max_checked: maxCheck,
        oldest_block_day: new Date(blockTime * 1000),
        days_since: elapsedWholeDays,
        hours_since: extraHours,
        number_of_tickets: tickets
      };
      console.log(infoHash);
      $("#display-data").html("");
      let infoContainer = $("#display-data");
      infoHTML =  '<h1>Tickets Overview</h1>' +
                  '<b>Ticket Address: </b>' +infoHash.ticket_address+ '<br>' +
                  '<a href="'+infoHash.url+'" target="_blank">Decred Block Explorer</a><br><br>' +
                  '<b>'+infoHash.txn_number+' transactions found</b> out of '+infoHash.max_checked+' searched<br>' +
                  'Staking for <b>'+infoHash.days_since+' days '+infoHash.hours_since+' hours</b>, since '+infoHash.oldest_block_day +
                  '<h1>Returns</h1>' +
                  'Staked: <b>' +infoHash.total_staking+ ' DCR</b><br>' +
                  '# of active Tickets: <b>' +infoHash.number_of_tickets+ ' tickets</b><br>' +
                  'Earned: <b>' +infoHash.total_earned+ ' DCR</b><br>' +
                  'Current ROI: <b>' +infoHash.current_roi+ '</b><br>' +
                  '<h1>Projections</h1>' +
                  'Average Daily Returns: '+infoHash.avg_daily_earn+' DCR earned per day, for a <b>'+infoHash.avg_daily_roi+' daily roi</b>.<br>' +
                  'Estimated Annual Returns: '+infoHash.est_annual_earn+' DCR earned in a year, for a <b>'+infoHash.est_annual_roi+' annual roi</b>.<br>';         
      infoContainer.append(infoHTML);
    });
  });
};

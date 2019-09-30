$('.example-button').on('click', e => {
  let ticketAddress = $(e.target).attr('data-addr');
  stuffToDo(ticketAddress)
  // fetchJSON(ticketAddress)
})

$('#input-button').on('click', () => {
  let ticketAddress = $("#dcr-addr").val().trim();
  stuffToDo(ticketAddress);
  // fetchJSON(ticketAddress);
});

function fetchJSON(addr) {
  const maxCheck = "8000" // The api doesn't return more than 8000 results
  const url = `https://explorer.dcrdata.org/api/address/${addr}/count/${maxCheck}/raw`;
  const request = {
    method: 'GET',
    url: url,
    dataType: 'json',
    success: handleSuccess,
    error: handleError,
  }
  $.ajax(request);
}
function handleError(error) {
  console.log({error});
}
function handleSuccess(response) {
  // set some calc values
  let dcrEarned = 0;
  let totalVotes = 0;
  let totalBuys = 0;
  let totalRevokes = 0;
  // let detectTest = [];
  
  // response is an array. loop through it.
  response.forEach(ticket => {
    // Tasks:
    // - get all votes and their stakegen (reward payout)
    // - grab all the ticket prices?
    // - count up all the ticket buys that are still active (un-voted)
    //   - the difference between total ticket buys and votes plus revokes
    // - need to know how much money hodled over what time frames to calc strategy comparisons
    //   - ie: vs btc hodl, not staking, optimal staking est., etc
  
    // 1) Check the ticket type (buy, vote, or revoke)
    // Votes: is the first input a stake base? Votes have that for the new coins created
    // Buys: is the first output a stake submission? Buys have that for the ticket payment
    // Revokes: is the first output a stake revoke? Revoked tickets are returned without reward
    
    if (ticket.vin[0].hasOwnProperty('stakebase')) {
      // Ticket type is 'Vote' (a successful ticket resolution)
      // detectTest.push('ticket vote');
      totalVotes++
      // Each vote has a reward payout in the first input. Lets add them all up:
      dcrEarned += ticket.vin[0].amountin;
    } else if (ticket.vout[0].scriptPubKey.type === 'stakesubmission') {
      // Ticket type is 'Buy' (a new unresolved ticket)
      // detectTest.push('ticket buy');
      totalBuys++
    } else if (ticket.vout[0].scriptPubKey.type === 'stakerevoke') {
      // Ticket type is 'Revoke' (a failed ticket resolution)
      // detectTest.push('ticket revoked');
      totalRevokes++
      // ToDo: confirm there are no other ways a ticket resolves besides Vote or Revoke.
    } else {
      // None of the above. Unrecognized ticket type
      console.log('Error: Unrecognized ticket type detected. Stats maybe be incorrect. Ticket details: ', ticket)
    }
  })
  // console.log(detectTest);
  console.log('Total Earned: ', dcrEarned);
  console.log('# of active Tickets: ', totalBuys - (totalVotes + totalRevokes));
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

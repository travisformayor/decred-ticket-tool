$(document).ready(function(){
  $('#button-data1').click(function () {
    var ticketAddress = "DckG48GELxZh3RdPttn2AWqVrxe9cV76ZXu";
    stuffToDo(ticketAddress);
  });

  $('#button-data2').click(function () {
    var ticketAddress = "Dckn5yPdFEtV4hY6yhEK3TzFAiLDNN6xoyJ";
    stuffToDo(ticketAddress);
  });

  $('#button-form').click(function () {
    let ticketAddress = $("#dcrAddress").val().trim();
    stuffToDo(ticketAddress);
  });

  function stuffToDo(addr) {
    var ticketAddress = addr;
    var maxCheck = "1000"
    var decredTicketAPI = "https://explorer.dcrdata.org/api/address/"+ticketAddress+"/count/"+maxCheck+"/raw";
    $.getJSON(decredTicketAPI, function (ticketData) {
      var staking = 0;
      var earned = 0;
      var oldestBlock = 0;
      var roi = 0;

      for (let i=0; i<ticketData.length;++i) {
        // Find oldest block on ticket address
        if (oldestBlock == 0) {oldestBlock = ticketData[i].vin[1].blockheight};
        if (oldestBlock > ticketData[i].vin[1].blockheight) {oldestBlock = ticketData[i].vin[1].blockheight};

        // add up all unspent and subract all spent
        if (ticketData[i].vout[0].scriptPubKey.type == "stakesubmission") { 
          staking += ticketData[i].vout[0].value;
        } else {
          staking -= ticketData[i].vin[1].amountin;
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
        console.log(elapsedWholeDays+" and "+extraHours);

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
          hours_since: extraHours
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
                    'Earned: <b>' +infoHash.total_earned+ ' DCR</b><br>' +
                    'Current ROI: <b>' +infoHash.current_roi+ '</b><br>' +
                    '<h1>Projections</h1>' +
                    'Average Daily Returns: '+infoHash.avg_daily_earn+' DCR earned per day, for a <b>'+infoHash.avg_daily_roi+' daily roi</b>.<br>' +
                    'Estimated Annual Returns: '+infoHash.est_annual_earn+' DCR earned in a year, for a <b>'+infoHash.est_annual_roi+' annual roi</b>.<br>';         
        infoContainer.append(infoHTML);
      });
    });
  };
});
// });
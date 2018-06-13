/*
  Beta Lightning network addition
*/
const base_url = "https://ddanppib10.execute-api.us-east-2.amazonaws.com/awslightning1/generateinvoice";
const check_btc_rates = (callback) => {
  axios.get(base_url + '?showRates=true').then((response) => {
    if (response.data !== undefined && response.data !== null) {
      if (response.data['status'] !== undefined && response.data['status'] !== null) {
        if (response.data['status'] === 200) {
          if (response.data['rates'] !== undefined && response.data['rates'] !== null) {
            callback({
              fetched: true,
              rates: response.data['rates']
            });
          } else {
            callback({
              fetched: false
            });
          }
        } else {
          callback({
            fetched: false
          });
        }
      } else {
        callback({
          fetched: false
        });
      }
    } else {
      callback({
        fetched: false
      });
    }
  });
};

const check_charge_id = (chargeId, callback) => {
  axios.get(base_url + '?checkCharge=true&chargeId=' + chargeId).then((response) => {
    if (response.data['response'] !== undefined) {
      if (response.data['response']['paid'] !== undefined) {
        if (response.data['response']['paid'] === true) {
          callback({
            chargeId: chargeId,
            IsPaid: response.data['response']['paid']
          });
        } else {
          callback({
            chargeId: chargeId,
            IsPaid: response.data['response']['paid']
          });
        }
      } else {
        callback({
          chargeId: chargeId,
          IsPaid: false
        });
      }
    } else {
      callback({
        chargeId: chargeId,
        IsPaid: false
      });
    }
  }).catch(function (error) {
    if (error.response.data['status'] !== undefined && error.response.data['status'] !== null) {
      if (error.response.data['status'] === 404) {
        callback({
          chargeId: chargeId,
          IsPaid: false,
          error: true,
          error_type: 'notexist'
        });
      } else {
        callback({
          chargeId: chargeId,
          IsPaid: false,
          error: true,
          error_type: error.response.data['message']
        });
      }
    }
  });
}
var receiptId = ''; // Global
/*
  Lightning App
*/
var lnapp = new Vue({
  el: '#lnapp',
  data: {
    amount: '0.50',
    message: '',
    lndinvoice: '',
    chargeId: '',
    paid: false,
    pollCount: 0,
    maxpollIntervals: 6,
    resultElement: '',
    pollWaitDiv: '',
    intervalId: ''
  },
  mounted: function() {
    console.log("lightning app initialized!");
    if (document.getElementById("paymentwidget") !== undefined && document.getElementById("paymentwidget") !== null) {
      console.log("Payment widget loaded!");
      if ((document.getElementById("submitbutton") !== undefined && document.getElementById("submitbutton") !== null) && (document.getElementById("descriptionform") !== undefined && document.getElementById("descriptionform") !== null)) {
        console.log("Adjust style")
        document.getElementById("descriptionform").style['margin-top'] = '5px';
        document.getElementById("submitbutton").style['margin-top'] = '5px';
      }
      if (document.getElementById('btcrates') !== undefined && document.getElementById('btcrates') !== null) {
        console.log("Loading BTC rates");
        check_btc_rates((btcratescb) => {
          console.log(btcratescb);
          if (btcratescb['rates'] !== undefined && btcratescb['rates'] !== null) {
            if (btcratescb['rates']['USD'] !== undefined || btcratescb['rates']['USD'] !== null) {
              document.getElementById('btcrates').innerHTML = '<p class="blurb">Please note, that our BTC Rate is <strong>$' + btcratescb['rates']['USD'].toString() + ' per BTC</strong></p>';
            }
          }
        });
      }
    } else {
      console.log("Payment widget not loaded");
    }

    if (document.getElementById("receiptcheck") !== undefined && document.getElementById("receiptcheck") !== null) {
      console.log("Receipt check loaded!");
      document.getElementById("checkreceiptref").style['margin-top'] = '5px';
    } else {
      console.log("Receipt check not loaded!");
    }
  },
  methods: {
    generateInvoice: function () { // Generates BTC lightning invoice
      this.resultElement = document.getElementById('result');
      if (parseFloat(this.amount) >= 0.005 && document.getElementById("descriptionform").value !== '') {
        // If description not empty and greator than half a cent
        this.resultElement.innerHTML = 'Amount is ' + this.amount.toString();
        var url = base_url + "?showInvoice=true&invoiceAmount=" + this.amount.toString() + "&invoiceDescription=" + encodeURIComponent(document.getElementById("descriptionform").value);
        this.resultElement.innerHTML = 'Fetching....';

        // Hide form when submitted
        if (document.getElementById("blurb") !== undefined && document.getElementById("blurb") !== null) document.getElementById("blurb").style.display = 'none'; //  Hide text
        if (document.getElementById("submitbutton") !== undefined) document.getElementById("submitbutton").style.display = 'none'; // hide submit button if exists
        if (document.getElementById("amountinput") !== undefined) document.getElementById("amountinput").style.display = 'none'; // hide amount if exists
        if (document.getElementById("descriptionform") !== undefined && document.getElementById("descriptionform") !== null) document.getElementById("descriptionform").style.display = 'none'; // Hide invoice description if exists
        if (document.getElementById("btcrates") !== undefined && document.getElementById("btcrates") !== null) document.getElementById("btcrates").style.display = 'none'; // Hide 'btcrates' if exist

        axios.get(url).then((response) => {
          if (response.data.info['id'] !== undefined && response.data['lnd_payment_request'] !== undefined) {
            this.chargeId = response.data.info['id'];
            receiptId = this.chargeId.replace('ch_','');
            this.lndinvoice = response.data['lnd_payment_request'];
            this.pollCount = 1;
            this.paid = false;
            this.resultElement.innerHTML = '<div id="innerresult"><strong>Please pay the following TESTNET ⚡️ lightning Invoice:</strong><span id="waitresults"></span><br />' + this.generateQRCode(response.data['lnd_payment_request']) + '<br />or copy the following payment request<br />' + this.generateLNDTextArea(response.data['lnd_payment_request']) + '</div><div id="reference">If you wish to manually check the payment status, quote payment reference <strong>' + receiptId + '</strong> to the admin</div>';
            this.pollWaitDiv = document.getElementById('waitresults');
            this.intervalId = setInterval(function () {
              console.log("Poll Job ID: " + this.intervalId.toString());
              if (this.pollCount >= this.maxpollIntervals || this.paid === true) {
                console.log("Cancel all waiting"); // If waiting timed out
                if (this.pollWaitDiv !== undefined && this.pollWaitDiv !== null) this.pollWaitDiv.innerHTML = ' (No longer checking for payments. Click <a onClick="document.getElementById(\'manualcheckstatus\').innerHTML = \'. Checking status...\'; check_charge_id(\'' + this.chargeId + '\', (cidcb) => {if (cidcb.IsPaid === true) {document.getElementById(\'result\').innerHTML = \'Thank you for your ⚡️ payment! ✅ <br />Should you require receipt verification please quote <strong>' + receiptId + '</strong> to the site admin. \'; } else { console.log(\'Still not paid. \'); document.getElementById(\'manualcheckstatus\').innerHTML = \'. Not Paid\'; } }); ">here</a> to manually check payment<span id="manualcheckstatus"></span>)';
                clearInterval(this.intervalId);
              } else {
                if (document.getElementById('waitresults')!== undefined && document.getElementById('waitresults') !== null) {
                  document.getElementById('waitresults').innerHTML = ' (Waiting for payment... )';
                  this.pollPayment(this.chargeId)
                } else { // Safety Stop
                  console.log("No longer polling because  'pollWaitDiv' element is no longer appearing");
                  clearInterval(this.intervalId);
                }
              }
            }.bind(this), 10000);
          } else {
            this.resultElement.innerHTML = 'Oh No! There was an error in response from LN API';
          }
        });
      } else {
        console.log('Do not submit');
      }
    },
    generateLNDTextArea: function(lndinvoice) {
      return "<textarea id='lndtextarea' cols='1' rows='5' style='width: 400px; height: 100px' onSelect='document.execCommand(\"copy\");' onClick='document.getElementById(\"lndtextarea\").select(); '>" + lndinvoice + "</textarea>";
    },
    generateQRCode: function(lndinvoice) {
      return "<img src=\"https://chart.apis.google.com/chart?cht=qr&chs=200x200&chl=" + lndinvoice + "\" />";
    },
    pollPayment: function (chargeId) {
      console.log("Before running pollPayment: " + this.paid.toString());
      if (this.pollCount < this.maxpollIntervals || this.paid === true) { // Either max poll or paid
        console.log("checking for payments... (ID: " + this.intervalId.toString() + ")");
        this.pollCount += 1;
        check_charge_id(chargeId, function(callback) {
          if (callback['IsPaid'] == true) {
            this.paid = callback.IsPaid;
            if (document.getElementById('waitresults') !== undefined && document.getElementById('waitresults') !== null) document.getElementById('waitresults').innerHTML = '';
            if (document.getElementById('result') !== undefined && document.getElementById('result') !== null) document.getElementById('result').innerHTML = 'Thank you for your ⚡️ payment! ✅.<br />Should you require receipt verification please quote <strong>' + receiptId + '</strong> to the site admin. ';
            console.log('Paid! Attempt to stop polling');
            clearInterval(this.intervalId);
          }
        });
      } else { // If poll payment still runs and paid true (this block probably doesnt get executed)
        if (this.pollWaitDiv !== undefined) this.pollWaitDiv.innerHTML = ' (No longer checking for payments. Please click <a onClick="document.getElementById(\'manualcheckstatus\').innerHTML = \'. Checking status...\'; check_charge_id(\'' + this.chargeId + '\', (cidcb) => {if (cidcb.IsPaid === true) {document.getElementById(\'result\').innerHTML = \'Thank you for your ⚡️ payment! ✅<br />Should you require receipt verification please quote <strong>' + receiptId + '</strong> to the site admin. \'; } else { console.log(\'Still not paid. \'); } }); document.getElementById(\'manualcheckstatus\').innerHTML = \'. Not Paid\'; ">here</a> to manually check payments <span id="manualcheckstatus"></span>)';
        console.log("No longer polling because paid");
      }
    },
    checkreceipt: function() {
      if (document.getElementById('receiptresult') !== undefined && document.getElementById('receiptresult') !== null && document.getElementById('receiptrefinput') !== undefined && document.getElementById('receiptrefinput') !== null) {
        if (document.getElementById('receiptrefinput').value !== undefined && document.getElementById('receiptrefinput').value !== null && document.getElementById('receiptrefinput').value !== '') {
          check_charge_id('ch_' + document.getElementById('receiptrefinput').value.toString(), function(callback) {
            var friendlyPaymentStatus = 'Not Paid';
            if (callback.IsPaid === true) friendlyPaymentStatus = 'Paid';
            if (callback.error !== undefined && callback.error !== null) {
              if (callback.error === true) {
                friendlyPaymentStatus = ' Unspecified Error';
                if (callback['error_type'] !== undefined && callback['error_type'] !== null) {
                  if (callback['error_type'] === 'notexist') friendlyPaymentStatus = 'Receipt does not exist!';
                }
              }
            }
            document.getElementById('receiptresult').style['margin-top'] = '4px';
            document.getElementById('receiptresult').innerHTML = 'The receipt reference <strong>' + document.getElementById('receiptrefinput').value.toString() + '</strong> for the invoice is: ' + friendlyPaymentStatus;
          });
        }
      }
    }
  } // End Methods in vue.js object
}); // End VUE.js

function toggleLNPay() {
  if (document.getElementById('lnpay').style.visibility == 'hidden') {
    document.getElementById('lnpay').style.visibility = 'visible';
  } else {
    document.getElementById('lnpay').style.visibility = 'hidden';
  }
}

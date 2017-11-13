var bitcoin = require('bitcoinjs-lib');
var sendgrid = require('@sendgrid/mail');
sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
const uuidv4 = require('uuid/v4');
const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
const mongoConnector = require('./mongo').MongoConnector;
const app = express();
const async = require('async');
const fs = require('fs');
const path = require('path');
var templateHtml = fs.readFileSync(path.join(__dirname,"confirm-mail.html"));
var vertcoinTestnet = {
    messagePrefix: 'Vertcoin Signed Message:\n',
    bip32: {
      public: 0x043587cf,
      private: 0x04358394
    },
    pubKeyHash: 0x4A,
    scriptHash: 0xC4,
    wif: 0xEF
};
var keyPair = bitcoin.ECPair.fromWIF(process.env.WALLET_PRIVATE_KEY, vertcoinTestnet);
var address = keyPair.getAddress();
console.log("Using wallet: ", address);

var backendServer = process.env.BACKEND_SERVER;
app.use(bodyParser.json());
var transactionCost = 99900;

var sendIdentityTransaction = function(payload, callback) {
    request(backendServer + "addressTxos/" + address, { json : true }, (error, response, result) => {
        var tx = new bitcoin.TransactionBuilder(vertcoinTestnet);
        var total = 0;
        result.forEach((txo) => {
            if(txo.spender == null) {
                if(total <= transactionCost) {
                    total += txo.value;
                    tx.addInput(txo.txhash,txo.vout);
                }
            }
        });
        tx.addOutput(address, total-transactionCost-100);
        tx.addOutput(payload.targetAddress, 100);
        var ret = bitcoin.script.compile(
            [
              bitcoin.opcodes.OP_RETURN,
              new Buffer("IDEN")
            ])
        tx.addOutput(ret, 0);
        var ret = bitcoin.script.compile(
            [
              bitcoin.opcodes.OP_RETURN,
              bitcoin.crypto.sha256(payload.identity.toLowerCase())
            ])
        tx.addOutput(ret, 0);
        tx.sign(0, keyPair);
        var txData = tx.build().toHex();
        request.post({url : backendServer + "sendRawTransaction", body : txData }, (error, response, result) => {
            console.log("Sent identity tx:", result);
            callback();
        });
    });
}
var sendQueue = async.queue(sendIdentityTransaction,1)

app.post('/identify', (req, res) => {
    mongoConnector.connectFromController(res, (db) => {
        var guid = uuidv4();
        db.collection("identity-requests").insert({ id : guid, confirmed : false, requestDate : new Date(), email : req.body.email, address : req.body.address }, (err, result) => {
            if(err) { 
                console.error(err);
                res.sendStatus(500);
                return;
            }

            var mail = `${templateHtml}`;
            mail = mail.replace("%name%",name);
            mail = mail.replace("%email%",req.body.email);
            mail = mail.replace("%address%",req.body.address);
            mail = mail.replace("%confirmid%",guid);

            var name = req.body.name;
            if(!name) name = req.body.email;

            var email = {
                from: 'noreply@decoscrypto.com',
                to : req.body.email,
                subject: 'Please confirm your identity, ' + name,
                html : mail
            };
            sendgrid.send(email, (err, response) => {
                if (err) {
                  console.error(err);
                } 
            });
             
            res.sendStatus(204);
        });
        
    });
    
});

app.get('/confirm', (req, res) => {
    mongoConnector.connectFromController(res, (db) => {
    
        db.collection("identity-requests").findOne({ id : req.query.id }, (err, identityRecord) => {
            if(err) { 
                res.sendStatus(500);
                return;
            }
            
            db.collection("identity-requests").update({ id : req.query.id }, { $set : { confirmed : true } }, (err, result) => {
                if(err) { 
                    res.sendStatus(500);
                    return;
                }

                sendQueue.push({identity:identityRecord.email, targetAddress: identityRecord.address});

                res.sendFile(path.join(__dirname,"confirm.html"));
            });
        });
    });
});



app.listen(3000, () => console.log('Example app listening on port 3000!'))
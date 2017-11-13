var bitcoin = require('bitcoinjs-lib');
var sendgrid = require('@sendgrid/mail');
sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
const uuidv4 = require('uuid/v4');
const express = require('express');
const bodyParser = require('body-parser');
const mongoConnector = require('./mongo').MongoConnector;
const app = express();
const fs = require('fs');
const path = require('path');
var templateHtml = fs.readFileSync(path.join(__dirname,"confirm-mail.html"));
app.use(bodyParser.json());
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
    
        db.collection("identity-requests").findOne({ id : req.query.id }, (err, result) => {
            if(err) { 
                res.sendStatus(500);
                return;
            }
            
            db.collection("identity-requests").update({ id : req.query.id }, { $set : { confirmed : true } }, (err, result) => {
                if(err) { 
                    res.sendStatus(500);
                    return;
                }
                res.sendFile(path.join(__dirname,"confirm.html"));
            });
        });
    });
});

app.listen(3000, () => console.log('Example app listening on port 3000!'))
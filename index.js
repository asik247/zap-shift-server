const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 3000;
const stripe = require('stripe')(process.env.STRIP_SECRIT);
const app = express();
//middleware;
app.use(cors());
app.use(express.json())
//?root apis;
app.get('/', (req, res) => {
    res.send('Hello this is root apis here now')
})
//? listiner here;
app.listen(port, () => {
    console.log(`This server is runing in port ${port}`);
})
const uri = `mongodb+srv://${process.env.USER_NAME}:${process.env.USER_PASSWORD}@cluster0.fdzc9ua.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});
async function run() {
    try {
        await client.connect();
        const myDB = client.db("zap-shif");
        const myPercelColl = myDB.collection("percelDatas");
        //?get db myperceldata;
        app.get('/percelDatas', async (req, res) => {
            const query = {};
            const email = req.query.email;
            if (email) {
                query.senderEmail = email
            }
            const options = { sort: { createdAT: -1 } }
            const cursor = myPercelColl.find(query, options);
            const result = await cursor.toArray();
            res.send(result)
        })
        //?specifique percle load;
        app.get('/percelDatas/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await myPercelColl.findOne(query);
            res.send(result)
        })
        //?post db addPercel data;
        app.post('/percelDatas', async (req, res) => {
            const allPercels = req.body;
            allPercels.createdAT = new Date();
            const result = await myPercelColl.insertOne(allPercels);
            res.send(result);

        })
        // ? percels delete method;
        app.delete('/percelDatas/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const query = { _id: new ObjectId(id) };
            const result = await myPercelColl.deleteOne(query);
            res.send(result);
        })
        //?Payment relative apis;
        app.post('/create-checkout-session', async (req, res) => {
            const paymentInfo = req.body;
            const amount = parseInt(paymentInfo.cost) * 100;
            const session = await stripe.checkout.sessions.create({
                line_items: [
                    {
                        // Provide the exact Price ID (for example, price_1234) of the product you want to sell
                        price_data:{
                            currency:'USD',
                            unit_amount:amount,
                            product_data:{
                                name:paymentInfo.percelName
                            }

                        },
                        quantity: 1,
                    },
                ],
                customer_email:paymentInfo.senderEmail,
                mode: 'payment',
                metadata:{
                    percleId:paymentInfo.percleId
                },
                success_url: `${process.env.STRIP_DOMAIN}/dashboard/payment-success`,
                cancel_url: `${process.env.STRIP_DOMAIN}/dashboard/payment-cancelled`,
            });
            console.log(session);
            res.send({url:session.url})

        })
        //?update user percel just practics perpose;
        // app.patch('/percelDatas',async (req,res)=>{

        // })









        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {

    }
}
run().catch(console.dir)
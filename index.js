const express = require('express');
const cors = require('cors');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 3000;
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
        app.get('/percelDatas',async(req,res)=>{
            const cursor = myPercelColl.find();
            const result = await cursor.toArray();
            res.send(result)
        })
        //?post db addPercel data;
        app.post('/percelDatas', async (req, res) => {
            const allPercels = req.body;
            const result = await myPercelColl.insertOne(allPercels);
            res.send(result);

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
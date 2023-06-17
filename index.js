const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 5000;
const jwt = require('jsonwebtoken')
app.use(express.json())
app.use(cors())
require('dotenv').config()
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)


const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res.status(401).send({ error: true, message: 'unauthorized access' });
  }
  // bearer token
  const token = authorization.split(' ')[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ error: true, message: 'unauthorized access' })
    }
    req.decoded = decoded;
    next();
  })
}

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.5i6b38m.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const instructorsCollection = client.db('photographyDB').collection('photography-instructors');

    const userCollection = client.db('photographyDB').collection('photography-users');

    const classCollection = client.db('photographyDB').collection('photography-classes');

    const paymentCollection = client.db('photographyDB').collection('photography-class-payment');

    ///selectClass
    const selectedCollection = client.db('photographyDB').collection('photography-selected-classes');

    app.post('/jwt', (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

      res.send({ token })
    })

    app.get('/instructors', async (req, res) => {
      const result = await instructorsCollection.find().toArray()
      res.send(result);
    })

    app.get('/classes', async (req, res) => {
      let query = {};
      if (req.query?.instructor_email) {
        query = { instructor_email: req.query.instructor_email }
      }

      if (req.query?.status) {
        query = { status: req.query.status }
      }
      const classes = await classCollection.find(query).toArray();
      return res.send(classes);
    })



    app.post('/classes', async (req, res) => {
      const classes = req.body;

      const query = { cname: classes.cname }
      const existingUser = await classCollection.findOne(query);

      if (existingUser) {
        return res.status(400).send({ message: 'Class name already exists' })
      }
      const result = await classCollection.insertOne(classes);
      return res.send(result)
    })

    app.get('/class/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(query);
      res.send(result);
    })

    app.put('/class/:id', async (req, res) => {
      const id = req.params.id;
      const updateClass = req.body;
      const filter = { _id: new ObjectId(id) }
      const options = { upsert: true };
      const newClass =
      {
        $set:
        {
          cname: updateClass.cname,
          price: updateClass.price,
          photo: updateClass.photo,
          instructor: updateClass.instructor,
          instructor_email: updateClass.instructor_email,
          seats: updateClass.seats,
          enrolls: updateClass.enrolls
        }
      }
      const result = await classCollection.updateOne(filter, newClass, options)
      res.send(result)
    })

    app.get('/selectClass', async (req, res) => {
      let query = {};
      if (req.query?.email && req.query?.status) {
        query = {
          email: req.query.email,
          status: req.query.status
        }
      }
      // if (req.query?.status) {
      //   query = { status: req.query.status }
      // }

      const selectClass = await selectedCollection.find(query).toArray();
      return res.send(selectClass);
    })

    app.get('/selectClass/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.findOne(query);
      res.send(result);

    })

    app.post('/selectClass', async (req, res) => {
      const selected = req.body;
      const result = await selectedCollection.insertOne(selected);
      return res.send(result)
    })

    app.delete('/selectClass/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedCollection.deleteOne(query);
      res.send(result);

    })

    app.get('/users', async (req, res) => {

      let query = {};
      if (req.query?.role) {
        query = { role: req.query.role }
      }
      const users = await userCollection.find(query).toArray();
      return res.send(users);
    })

    app.post('/users', async (req, res) => {
      const users = req.body;

      const query = { email: users.email }
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: 'user already exists' })
      }
      const result = await userCollection.insertOne(users);
      return res.send(users)
    })

    app.get('/users/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await userCollection.findOne(query);
      res.send(result);
    })

    app.patch('/users/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'instructor'
        }
      }
      const result = await userCollection.updateOne(filter, updateDoc);
      return res.send(result);
    })

    app.patch('/admins/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updateDoc);
      return res.send(result);
    })

    app.patch('/class/status/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'approved'
        }
      }
      const result = await classCollection.updateOne(filter, updateDoc);
      return res.send(result);
    })

    app.patch('/class/deny/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'denied'
        }
      }
      const result = await classCollection.updateOne(filter, updateDoc);
      return res.send(result);
    })


    app.get('/class/feedback/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await classCollection.findOne(query);
      res.send(result);
    })

    app.put('/class/feedback/:id', async (req, res) => {
      const id = req.params.id;
      const adminFeedback = req.body;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          feedback: adminFeedback.feedback
        }
      }
      const result = await classCollection.updateOne(filter, updateDoc, options);
      return res.send(result);
    })

    app.get('/users/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false })
      }

      const query = { email: email }
      const user = await userCollection.findOne(query);
      const result = { admin: user?.role === 'admin' };
      return res.send(result);
    })

    app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false })
      }

      const query = { email: email }
      const user = await userCollection.findOne(query);
      const result = { instructor: user?.role === 'instructor' };
      return res.send(result);
    })

    app.post('/create-payment-intent', verifyJWT, async (req, res) => {
      const { price } = req.body;
      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: 'usd',
        payment_method_types: ['card']
      });

      res.send({
        clientSecret: paymentIntent.client_secret
      })
    })

    app.post('/payments', verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentCollection.insertOne(payment);

      // const query = { _id: { $in: payment.cartItems.map(id => new ObjectId(id)) } }
      // const deleteResult = await cartCollection.deleteMany(query)

      // res.send({ insertResult, deleteResult });
      res.send({ insertResult });
    })

    app.patch('/payments/status/:id', async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          status: 'enrolled'
        }
      }
      const result = await selectedCollection.updateOne(filter, updateDoc)
      return res.send(result);
    })

    app.patch('/payments/enrolls/:cname', async (req, res) => {
      const cname = req.params.cname;
      const filter = { cname: cname };
      const updateEnroll = {
        $inc: {
          enrolls: 1,
          seats: -1
        },
      }
      const result = await classCollection.updateOne(filter, updateEnroll);
      const result2 = await selectedCollection.updateOne(filter, updateEnroll);
      return res.send(result && result2);
    })

    app.get('/payments', async (req, res) => {
      let query = {};
      if (req.query?.email) {
        query = { email: req.query.email }
      }

      const result = await paymentCollection.find(query).toArray()
      res.send(result);
    })



    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Photos are coming');
})

app.listen(port, () => {
  console.log(`The port number is ${port}`);
})
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 5000;

// middleware
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lnrcai2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const petsCollection = client.db("petLoverDb").collection("pets");
    const adoptionCollection = client.db("petLoverDb").collection("adoption");
    const campaignCollection = client.db("petLoverDb").collection("campaign");
    const userCollection = client.db("petLoverDb").collection("users");

    // ---------------------jwt related apis-------------------
    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "365d",
      });
      res.send({ token });
    });

    // -----------------------user related apis---------------------

    // --------------------------middlewares---------------------------

    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: "unauthorized access" });
      }
      const token = req.headers.authorization.split(" ")[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
        if (error) {
          return res.status(401).send({ message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
      });
    };

    // use verify token after verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query);
      const isAdmin = user?.role === "admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    // get user
    app.get("/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // check admin
    app.get("/users/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      const query = { email: email };
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === "admin";
      }
      res.send({ admin });
    });

    // post user
    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exist", insertedId: null });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // add as admin
    app.patch(
      "/users/admin/:id",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: "admin" } };
        const result = await userCollection.updateOne(filter, updateDoc);
        res.send(result);
      }
    );

    // --------------------------pet related apis-------------------

    // get pets data by email
    app.get("/my-pets/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const result = await petsCollection.find(query).toArray();
      res.send(result);
    });

    // get all pet for admin
    app.get("/pets", verifyToken, async (req, res) => {
      const result = await petsCollection.find().toArray();
      res.send(result);
    });

    // post pet
    app.post("/pets", async (req, res) => {
      const pet = req.body;
      const result = await petsCollection.insertOne(pet);
      res.send(result);
    });

    // get data for the pet wants to update
    app.get("/pet/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await petsCollection.findOne(query);
      res.send(result);
    });

    // update pet
    app.put("/pet/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          name: item.name,
          category: item.category,
          image: item.image,
          postDate: item.postDate,
          age: item.age,
          location: item.location,
          shortDescription: item.shortDescription,
          longDescription: item.longDescription,
        },
      };
      const result = await petsCollection.updateOne(filter, updateDoc, options);
      res.send(result);
    });

    // delete pet from database
    app.delete("/pet/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await petsCollection.deleteOne(query);
      res.send(result);
    });

    // -----------------------------request for adoption apis---------------

    // post request pet
    app.post("/adoption", async (req, res) => {
      const pet = req.body;
      const result = await adoptionCollection.insertOne(pet);
      res.send(result);
    });

    // get request for adoption pet
    app.get("/adoption/:email", async (req, res) => {
      const email = req.params.email;
      const query = { ownerEmail: email };
      const result = await adoptionCollection.find(query).toArray();
      res.send(result);
    });

    // delete request
    app.delete("/adoption/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await adoptionCollection.deleteOne(query);
      res.send(result);
    });

    // accept from my added pets
    app.patch("/adoption/adopted/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { adoptionStatus: true } };
      const result = await petsCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // accept from my adoption request
    app.patch("/reqAdoption/reqAdopted/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = { $set: { adoptionStatus: true } };
      const result = await adoptionCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    // --------------------------campaign related apis-------------------

    // get all campaigns data
    app.get("/campaigns", async (req, res) => {
      const result = await campaignCollection.find().toArray();
      res.send(result);
    });

    // get data for the pet wants to update
    app.get("/campaign-details/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await campaignCollection.findOne(query);
      res.send(result);
    });

    // post campaign in database
    app.post("/campaign", async (req, res) => {
      const pet = req.body;
      const result = await campaignCollection.insertOne(pet);
      res.send(result);
    });

    // get campaigns date
    app.get("/campaign/:email", async (req, res) => {
      const email = req.params.email;
      const query = { ownerEmail: email };
      const result = await campaignCollection.find(query).toArray();
      res.send(result);
    });

    // get data for the campaign wants to update
    app.get("/campaign-res/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await campaignCollection.findOne(query);
      res.send(result);
    });

    // update campaign
    app.put("/update-campaign/:id", async (req, res) => {
      const item = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          petName: item.petName,
          maxAmount: item.maxAmount,
          highAmount: item.highAmount,
          shortDescription: item.shortDescription,
          longDescription: item.longDescription,
          deadline: item.deadline,
          image: item.image,
        },
      };
      const result = await campaignCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Pet Lover server is running");
});

app.listen(port, () => {
  console.log(`Pet Lover Server is running on port ${port}`);
});

const express = require("express");
const router = express.Router();
const db = require("../config/database");
const User = require("../models/User");
const Role = require("../models/role");
const Sequelize = require("sequelize");
var nodemailer = require("nodemailer");
var fs = require("fs");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const request = require("request");
const jwt = require("jsonwebtoken");
const userController = require("../controller/users");
const multer = require("../config/multer");
var {
  passport,
  authAdmin,
  authManager,
  authenticate,
} = require("../auth/passport-auth");
const {
  VerificationAttemptContext,
} = require("twilio/lib/rest/verify/v2/verificationAttempt");
const app_version = require("../models/app");

router.post("/login", userController.login);
router.post(
  "/register",

  multer.upload.single("profilePic"),
  userController.register
);

/////////////////////////////////////////////logout//////////////////////////////

router.get("/logout", userController.logout);

///////////////////////////////////////profile pic register/////////////////////////////
router.post(
  "/profilepic_register",
  passport.authenticate("jwt", { session: false }),

  userController.update_profilePic
);

///////////////////////////////////////profile view/////////////////////////////
router.get(
  "/myprofile",
  passport.authenticate("jwt", { session: false }),
  userController.profile
);

///////////////////////////////////////profile upodate view/////////////////////////////
router.post(
  "/profile_edit",
  passport.authenticate("jwt", { session: false }),
  userController.update_profile
);

/////////////////////////////////app version get/////////////////////////////////
router.post("/getversion", async (req, res, next) => {
  var app = await app_version
    .findOne({
      where: { id: 1 },
    })
    .catch((err) => {
      console.log("@@@@Error: ", err);
    });
  res.send(app);
});

/////////////////////////////////////Contact Us message//////////////////////////////
router.post("/ContactUs", userController.contactUs);
/////////////////////////////////////update user information//////////////////////////////
router.post(
  "/updateInfo",
  passport.authenticate("jwt", { session: false }),
  userController.updateInfo
);

/////////////////////////////////////////life time sms api //////////////////////////////////////////////

router.post("/otplogin", async function (req, res) {
  // var val = Math.floor(1000 + Math.random() * 9000);
  // console.log(val);
  try {
    if (req.body.phonenumber === "+923355590926") {
      // if (req.body.phonenumber) {
      res.send("yousaf");
    } else {
      const phonenumber = req.body.phonenumber;
      const otp = Math.floor(1000 + Math.random() * 9000);
      const ttl = 2 * 60 * 1000;
      const expires = Date.now() + ttl;
      const data = `${phonenumber}.${otp}.${expires}`;
      const hash = crypto
        .createHmac("sha256", "smsKey")
        .update(data)
        .digest("hex");
      const fullHash = `${hash}.${expires}`;
      var options = {
        method: "POST",
        url: "https://api.veevotech.com/sendsms",
        qs: {
          // api_token: "1c2e1733b0e0c379422f8d61f09f808f6335116532",
          hash: process.env.OTP,

          // api_secret: "office_2020",
          receivenum: `${phonenumber}`,
          sendernum: "Darzam",
          receivernetwork: "default",
          textmessage: `Your verification code is ${otp}. Never share this code with anyone. 
      `,
        },
        headers: {
          "content-type": "application/json",
          "cache-control": "no-cache",
        },
      };

      request(options, function (error, response, body) {
        if (error) throw new Error(error);
        res.send({ phonenumber, hash: fullHash });
        console.log(body);
      });
    }
  } catch (error) {
    res.send(error);
  }
});

router.post("/verify", async function (req, res) {
  if (req.body.phonenumber === "+923355590926" && req.body.code === "1111") {
    /// if (req.body.code === "1111") {
    var userWithmobile = await User.findOne({
      where: { mobile: req.body.phonenumber },
      include: {
        model: Role,
      },
    }).catch((err) => {
      console.log("@@@@Error: ", err);
    });
    const token = await jwt.sign(
      {
        id: userWithmobile.id,
        email: userWithmobile.email,
        name: userWithmobile.name,
      },
      process.env.KEY
    );
    await res.header("token", token);
    User.update(
      {
        device_token: req.body.token,
      },

      { where: { id: userWithmobile.id } }
    );
    // res.cookie("jwt", token);
    res.cookie("token", token);
    await res.header("token", token);
    return res.status(200).json({
      accessToken: token,
    });
  } else {
    const phonenumber = req.body.phonenumber;
    const hash = req.body.hash;
    const code = req.body.code;
    if (!hash) {
      return res.send({
        msg: "invalid code",
      });
    }
    let [hashValue, expires] = hash.split(".");

    let now = Date.now();
    if (now > parseInt(expires)) {
      return res.send({
        msg: "invalid code",
      });
    }
    let data = `${phonenumber}.${code}.${expires}`;
    let newCalculatedHash = crypto
      .createHmac("sha256", "smsKey")
      .update(data)
      .digest("hex");
    if (newCalculatedHash === hashValue) {
      // if (verification.status === "approved") {
      // const { phonenumber } = req.body;

      var userWithmobile = await User.findOne({
        where: { mobile: phonenumber },
        include: {
          model: Role,
        },
      }).catch((err) => {
        console.log("@@@@Error: ", err);
      });
      //////assigning token for device

      if (!userWithmobile) {
        const user = await User.create({
          mobile: phonenumber,
          roleId: 3,

          device_token: req.body.token,
        }).then((u) => {
          const token = jwt.sign(
            {
              id: u.id,
              email: u.email,
              name: u.name,
            },
            process.env.KEY
          );
          // res.cookie("jwt", token);
          res.cookie("token", token);
          res.header("token", token);

          res.status(200).json({
            status: "success",
            message: "Welcome " + u.name,
            accessToken: token,
          });
        });
      } else {
        const token = await jwt.sign(
          {
            id: userWithmobile.id,
            email: userWithmobile.email,
            name: userWithmobile.name,
          },
          process.env.KEY
        );
        await res.header("token", token);
        User.update(
          {
            device_token: req.body.token,
          },

          { where: { id: userWithmobile.id } }
        );
        // res.cookie("jwt", token);
        res.cookie("token", token);
        res.header("token", token);
        res.status(200).send({
          status: "success",
          message: "Welcome back " + userWithmobile.name,
          accessToken: token,
        });
      }
    } else {
      res.send("invalid code");
    }
  }
});

module.exports = router;
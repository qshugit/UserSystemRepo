'use strict'; 

const Hapi = require('hapi');
const Joi = require('joi');
const Hab = require('hapi-auth-basic');
const Basic = require('hapi-auth-basic');
const Bcryptjs = require('bcryptjs');
const PgPromise = require('pg-promise');
const HASH_FACTOR = 10;
const server = new Hapi.Server();

server.connection({ 
	port: 3000
});

/*Starting to acquire database connection*/
var pgp = PgPromise();
var cn = {
    host: 'localhost', 
    port: 5432,
    database: 'HapiProject',
    user: 'postgres',
    password: ''
};
var db = pgp(cn); // database instance;
/*End of acquiring database connection*/

var currentUser = null;

/*
 * fetch user information from db and validate it against user input
 */
const validate = function (request, username, password, callback) {
    var expectedPass = null;
	var userEmail = null;
	var firstName = null;
	var lastName = null;
	
	//load the user
	db.any("SELECT * FROM USER_DATA WHERE email=$1", username)
		.then(function (data) {
			if (typeof data !== 'undefined' && data.length > 0) {
				expectedPass = data[0].password;
				userEmail = data[0].email;
				firstName = data[0].first_name;
				lastName = data[0].last_name;
				
				//if user doesn't exist
				if (userEmail == null) {
					return callback(null, false);
				}

				//load user password
				Bcryptjs.hash(expectedPass, HASH_FACTOR, function(err, hash) {
					if (err) {
						console.log("Bcryptjs hash: " + err);
					}
					
					Bcryptjs.compare(password, hash, function(err, isMatch) {
						if (isMatch) {
						//set this user as the current user
							currentUser  = userEmail;
						}
						
						callback(err, isMatch, {first_name: firstName, last_name: lastName, 
							email: userEmail});
					});
				});
			} else {
				return callback(null, false);
			}
		})
		.catch(function (error) {
			console.log("Db catch: " + error);			
		});	
};

//function used to validate the old password when resetting
//password
const validateOldPass = function (oldPass) {
	
}

//registering static pages
server.register(require('inert'), (err) => {
    if (err) {
        throw err;
    }
	
	//specify path to a background image here
	server.route({
        method: 'GET',
        path: '/background.jpg',
        handler: function (request, reply) {
            reply.file('./image/background.jpg');
        }
    });
	
	server.route({
        method: 'GET',
        path: '/signup',
        handler: function (request, reply) {
            reply.file('./public/signup.html');
        }
    });	
});

//register hapi-auth-basic for login and reset,
//reset authenticates with the authentication token again
//and then redirect to reset.html, upon the submission
//of the form the /api/reset route will be triggered to validate and
//save the new password.
server.register(Basic, (err) => {
    server.auth.strategy('simple', 'basic', { validateFunc: validate });
    server.route({
        method: 'GET',
        path: '/api/login',
        config: {
            auth: 'simple',
            handler: function (request, reply) {
                reply('First Name: ' + request.auth.credentials.first_name + "<br><br>"
					+ "Last Name: " + request.auth.credentials.last_name + "<br><br>"
					+ "Email: " + request.auth.credentials.email + "<br><br>"
					+ "<font color=blue>You have successfully logged in.</font>");
            }
        }
    });
	
	server.route({
        method: 'GET',
        path: '/reset',
		config: {
            auth: 'simple',
            handler: function (request, reply) {
                reply.file('./public/reset.html');
            }
        }
    });
});

//api route for signup
server.route({
	method: 'POST',
	path: '/api/signup',
	config: {
		handler: function (request, reply) {
			var firstName = request.payload.first_name;
			var lastName = request.payload.last_name;
			var pass = request.payload.password;
			var email = request.payload.email;
		
			var output = "First Name: " + firstName + "<br><br>"
				 + "Last Name: " + lastName + "<br><br>"
				 + "password: " + pass;
			//inserting values into table - USER_DATA
			db.none("INSERT INTO USER_DATA(first_name, last_name, password, email) values($1, $2, $3, $4)"
				, [firstName, lastName, pass, email])
				.then(function () {
					output += "<br><br><font color=blue>You have successfully signed up.</font>"
					reply(output);
				})
				.catch(function (error) {
					console.log(error);
					reply("An error has occurred: " + error)
				});						
		},
		validate: {
			payload: {
				first_name: Joi.string().max(255).required(),
				last_name: Joi.string().max(255).required(),
				email: Joi.string().email().max(255).required(),
				password: Joi.string().min(5).max(20).required(),
				//to validate if the re-entered password is the same as the one before
				re_password: Joi.any().valid(Joi.ref('password')).required()
					.options({ language: { any: { allowOnly: 'Passwords do not match!' } } })
			}
		}
	}
});


//api route for reset
server.route({
	method: 'POST',
	path: '/api/reset',
	handler: function (request, reply) {	
		var userId = null;
		var oldPass = request.payload.old_password;
		var newPass = request.payload.new_password;
		var expectedPass = null;

		if (currentUser == null) {
			reply("Please try to login again.");
		}
		
		//load the user
		db.any("SELECT * FROM USER_DATA WHERE email=$1", currentUser)
			.then(function (data) {
				if (typeof data !== 'undefined' && data.length > 0) {
					expectedPass = data[0].password;
					userId = data[0].id;
					//if user doesn't exist
					if (userId == null) {
						reply("Unknown error occurred.");
					}
					
					//load user password
					Bcryptjs.hash(expectedPass, HASH_FACTOR, function(err, hash) {
						if (err) {
							console.log("Bcryptjs hash: " + err);
						}
						
						Bcryptjs.compare(oldPass, hash, function(err, isMatch) {
							//check if the old password matches the expected password
							if (isMatch) {
								//if the passwords match, update database.
								db.tx(function (t) {						
									return t.batch([
										t.none("UPDATE USER_DATA SET PASSWORD=$1 WHERE ID=$2", [newPass, userId]),									
									]);
								})
								.then(function (data) {
									//reply success
									reply("<font color=blue>Your password has been successfully updated.</font>");
								})
								.catch(function (error) {
									console.log("ERROR:", error.message || error);
								});															
							} else {
								reply("<font color=blue>Your old password does not match our record, please try again.</font>");
							}
						});
					});
				} else {
					return false
				}
			})
			.catch(function (error) {
				console.log("Db catch: " + error);			
			});		
	},
	config: {
		validate: {
			payload: {
				old_password: Joi.string().min(5).max(20).required(),
				new_password: Joi.string().min(5).max(20).required(),
				//to validate if the re-entered password is the same as the one before
				re_new_password: Joi.any().valid(Joi.ref('new_password')).required()
					.options({ language: { any: { allowOnly: 'New Passwords do not match!' } } })
			}
		}
	}
});

server.start(() => {
	console.log('Server running at: ' + server.info.uri);
});
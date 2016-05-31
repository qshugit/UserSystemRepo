# UserSystemRepo
The database table USER_DATA can be found in the folder "dbTables I installed Postgres and created a Database called HapiProject, which does not require a poassword to connect, and the default user name is postgres (Connection details: line 17 to line 25 in server.js ) To start the application, use command "node server.js"

http://localhost:3000/signup: This the signup page, input your information and click signup, then http://localhost:3000/api/signup will be triggered. If validation succeed, the user willl be stored in the database, error will be reported otherwise.

http://localhost:3000/api/login: Simply input your credentials, if credentials are incorrect, user will be prompted with the window to try again; if succeeds, user information will be printed and notified with a successful login.

http://localhost:3000/reset: If user is not logged in, then user will be prompted to login first. Once user is logged in, the page will display the password reset page, and from there user will be able to input required information, and upon a succesful validation, the password will be succesfully updated in the database.
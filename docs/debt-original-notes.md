> M6: `web/` är borttagen. Sökvägarna under `web/` här är historik.

- api/package.json 14 express out of date
- api/index.js 12 what is the limit 50mb thing
- api/index.js 27 error handling on node process does not send any feedback
to the frontend
- api/routes/auth.js 11 compares column named pw_hash with plaintext pw so it
  looks like from here that pw is stored also as plaintext. actually confirmed
  via xh that login works so pw is stored as plain text
- api/routes/auth.js 19 does not vaildate req.body 
- api/routes/auth.js 20 saves plaintext pw in db.
- api/routes/auth.js 24 response sends back the whole user row to frontend
including the password

- api/routes/guides.js 7 again uses postgres pool instead of drizzle client
- api/routes/guides.js no error handling or empty response state
- api/routes/guides.js 17 res shape difficult to read 
- api/routes/guides.js 24 no error handling/empty state
- api/routes/guides.js 24 risk for sql injection no parametrized query
- api/routes/guides.js 36 no validation of request body need to send a proper
error state on failure.
- api/routes/photos.js 10 image resize logiken in router handlern -> svårt
att byta ut etc no error handling there either
- api/routes/tours.js 7 strange query consruction. could use join and the same
use drizzle instead. no error handling plus standardized empty response
- api/routes/tours.js  no empty state repsonse
- api/routes/tours.js 29 again serial query could be join or so with drizzle.
- api/routes/tours.js 38 no request.body validation
- api/routes/tours.js 47 should probably also have requireUser also no
  error handling if id etc was not found

config.js -> Move to ENV file highest risk is jwtSecret being committed.
also defines aport which is not used in frontend. could be monorepo setup with
global env to reuse port etc. plus direct connection to db probably needs a
connection string with password which would also need to be handled via ENV and
interpolated.

db/client.js -> 9 exports the wrapped pg pool as a drizzle but app does not
use it.

db/schema.js -> 39 this should be probably be indexed. why does it grow with
300 rader per tour. 

db/schame.js -> 29 userId and guideId should Fkd 

db/schama.js -> 23 what is the heroImage text, should a link to the image hosted
somewhere or what?

db/migrate.js 1 -> why not? drizzle is a dep of the project. so easy upgrade
plus this is very high risk for drift since tables are defined as drizzle
tables why not run migrations from them?

web/src/api.js defines and API_URL but in the app the url in fetches is
hardcoded

web/src/App.jsx -> token is stored in local storage.

lib/auth.js which routes should be protected?
lib/auth.js 9 och 15 should not give any details about why auth failed.
'bad request'

web/src/style.css is a gigangitc mess


api/somewhere and web/src/components/GuideCard.tsx content is stored as raw
html in db then directly set as html in frontend. risk for xss better approach
sanitize html parse into object in db then vice versa in frontend

web/src/pages/Guides.tsx
    -> fetch row 9 has no error handling and also no

- appen använder postgres pooler directly -> makes no sense since app uses
drizzle as db so we should use the drizzle client
- the whole thing should be typescript in the first place

- web/src/pages/Tours.jsx -> tour response is very large ca 300kb presumably
due to all logs also being send. should be handled in api route and only
select and respond with relant info for the tours page. i hink we should
establih a central domain type definition file to handle comms between
frontend and backend then we can use zod to parse and vaildate reponses
either way.

web/src/api.js does not do any error handling or validation as of now. ideally
this uses zod and railway pattern. 

many files in web/ do not use the api get / put functions but harcode the
endpoints

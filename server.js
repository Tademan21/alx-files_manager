import express from 'express';
import bodyParser from 'body-parser';
import router from './routes';

const app = express();
const port = process.env.PORT || 5000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true,
}));

app.use(router);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

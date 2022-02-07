import express from 'express';
import bodyParser from 'body-parser';
import {
  env,
} from 'process';
import router from './routes';

const app = express();
const port = env.PORT || 5000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true,
}));

app.use(router);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

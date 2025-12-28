# CS2 Inspect Service

This is a simple inspect service for CS2. The service is built using [Nest.js](https://nestjs.com/) and [MongoDB](https://www.mongodb.com/).

## Installation

It is recommended to use pnpm to install the dependencies. If you don't have pnpm installed, you can install it using the following command:

```bash
$ npm install -g pnpm
```

Then, you can install the dependencies using the following command:

```bash
$ pnpm install
```

## Deployment

You can deploy the server using the following command:

```bash
$ pnpm run build
```

The server will be built in the `dist` directory. You can run the server using the following command:

```bash
$ node dist/main.js
```

You can also use the following command to run the server:

```bash
$ pnpm run deploy
```

This will build and run the server in one command with PM2.

## Docker

You can also run the server using Docker. You can build the Docker image using the following command:

```bash
$ docker build -t cs2-inspect-server .
```

Then, you can run the Docker container using the following command:

```bash
$ docker run -p 3000:3000 -d cs2-inspect-server
```

## Configuration

The server is configured to run on port 3000. If you want to change the port, you can do so by modifying the `PORT` environment variable in the `.env` file.

```bash
PORT=3000
```

### Database

The server uses MongoDB to store the data. The database is configured using the `DATABASE_URL` environment variable in the `.env` file.

```bash
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/database?appName=AppName
```

### Proxy

The server uses a proxy to connect to the internet. The proxy is configured using the environment variables in the `.env` file.

```bash
PROXY_URL=[socks5|http]://[username][session]:[password]@[url]:[port]
```

### Ping Pricempire

You can share the data with Pricempire by setting the `PING_PRICEMPIRE` environment variable to `true`.

```bash
PING_PRICEMPIRE=true
```

### Refresh Stickers

You can refresh the stickers by setting the `ALLOW_REFRESH` environment variable to `true`.

```bash
ALLOW_REFRESH=true
```

Pass `true` to the `refresh` query parameter to refresh the stickers. (This will only work if `ALLOW_REFRESH` is set to `true`) (Do not recommended to spam the endpoint with refresh requests, as it will result in a ban by the GC.)

```bash
$ curl -X GET -H "Content-Type: application/json" http://localhost:3000/?url=steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198023809011A35678726741D4649654965632117657&refresh=true
```

### GameCoordiantor Logging

You can enable logging for the GameCoordiantor by setting the `GC_DEBUG` environment variable to `true`.

```bash
GC_DEBUG=true
```

### accounts.txt

The `accounts.txt` file contains the accounts that are used to authenticate the users. The file is located in the `root` directory.

```bash
# accounts.txt
username1:password1
username2:password2
```

### .env

The `.env` file contains the environment variables that are used to configure the server.

```bash
# .env
PORT=3002
DATABASE_URL=mongodb+srv://username:password@cluster.mongodb.net/database
PROXY_URL=[socks5|http]://[username][session]:[password]@[url]:[port]
GC_DEBUG=false
PING_PRICEMPIRE=false
ALLOW_REFRESH=false
```

## Running the server

You can run the server using the following command:

```bash
$ pnpm start
```

The server will start on the port that is specified in the `.env` file.

## Development

You can run the server in development mode using the following command:

```bash
$ pnpm run start:dev
```

The server will start on the port that is specified in the `.env` file.

### API

The server has the following API endpoints:

#### GET /

This endpoint is used to inspect the data that is being sent to the server.

```bash
$ curl -X GET -H "Content-Type: application/json" http://localhost:3000/?url=steam://rungame/730/76561202255233023/+csgo_econ_action_preview%20S76561198023809011A35678726741D4649654965632117657
```

##### Response

```json
{
    "iteminfo": {
        "stickers": [
            {
                "slot": 0,
                "stickerId": 5935,
                "codename": "csgo10_blue_gem_glitter",
                "material": "csgo10/blue_gem_glitter",
                "name": "Blue Gem (Glitter)"
            }
        ],
        "itemid": "35675800220",
        "defindex": 1209,
        "paintindex": 0,
        "rarity": 4,
        "quality": 4,
        "paintseed": 0,
        "inventory": 261,
        "origin": 8,
        "s": "76561198023809011",
        "a": "35675800220",
        "d": "12026419764860007457",
        "m": "0",
        "floatvalue": 0,
        "min": 0.06,
        "max": 0.8,
        "weapon_type": "Sticker",
        "item_name": "-",
        "rarity_name": "Remarkable",
        "quality_name": "Unique",
        "origin_name": "Found in Crate",
        "full_item_name": "Sticker | Blue Gem (Glitter)"
    }
}
```

# Contributing

If you want to contribute to the project, you can do so by creating a pull request.

# License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

# Acknowledgements

- [Nest.js](https://nestjs.com/)
- [MongoDB](https://www.mongodb.com/)
- [Mongoose](https://mongoosejs.com/)
- [Axios](https://axios-http.com/)
- [CS2](https://blog.counter-strike.net/)
- [node-globaloffensive](https://github.com/DoctorMcKay/node-globaloffensive)
- [node-steam-user](https://github.com/DoctorMcKay/node-steam-user)

# Thanks To

- [DoctorMcKay](https://github.com/DoctorMcKay)
- [CSFloat.com](https://csfloat.com/)
- [Pricempire](https://pricempire.com/)

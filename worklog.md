# Day 1

- Setup a Rust server and gave up
- Set up a nodejs server with Hapi, Fastify and gave up with both
- Set up a nodejs with formidable
- Added endpoint to handle uploads


# Day 2

Had some issues getting the multi part upload to work, is it wouldn't save to tmp but elsewhere
- finally got it to work and added child process invokation
- To convert uploaded file from mp3 to PCM via ffmpeg process
- To denoise via rnnoise processd
- To convert from PCM to mp3 via ffmpeg process
- Added code to download once the processes complete
- Added html form to be able to test that
- Added code to wipe everything from the tmp folder once the processes complete
- Test

still have to make a container to set up rnnoise and ffmpeg and launch that nodejs server.
Will then integrate that in the applycreature front-end, that will be the first simple examplary creatures


# Day 3

- Styled the upload form propertly with dummy progress animationß
- Made container
- deployedto Fly.io
- Test
- Add recording browser function

# Day 4

Doc, I tried to generate from source annotation, but stuggled with half baked or old libs, so simply wrote the swagger spec in json as
this is very simple API, but for more complex apps with many endpoints and parameters, best to use annotation supported by typescript. 
it can be done.

- Added swagger descriptor. copy swagger-ui 
- Server swagger-ui content, via the nodejs process, as static files
- Add reDoc script
- Now OpenAPI/Swagger and Redoc are served by the same server
- CORS is not tested, and I don't care for now


# Day 5

- CORS is now tested
- Deployed
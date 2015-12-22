# gulp-css-freezer

> CSS resources freezer. The best use for cache invalidation.

## What it does

###### Source CSS file

```css
.img-01 {
    background: red url("../img/img-01.jpg") no-repeat center bottom;
}

.img-01-clone {
    background: red url(../img/img-01-clone.jpg); /* same image content but different name */
}

.img-02 {
    background: red url('../img/img-02.jpg');
}

.data-uri-url {
    background-image: url(data:text;base64,LmRhdGEtdXJpLXVybA==);
}

.data-external-protocols {
    background-image: url('http://xmp.com/http-img.gif');
    background: url('https://xmp.com/https-img.gif');
    background: url("//xmp.com/no-protocol-img.gif");
}
@font-face {
    font-family: PTSans;
    src: url('../fonts/pt-sans-regular.eot');
    src: url('../fonts/pt-sans-regular.eot?#iefix') format('embedded-opentype'),
        url('../fonts/pt-sans-regular.woff') format('woff'),
        url('../fonts/pt-sans-regular.ttf') format('truetype');
    font-weight: normal;
    font-style: normal;
}
```

###### Freezed CSS file

```css
.img-01 {
    background: red url("356a192b7913b04c54574d18c28d46e6395428ab.jpg") no-repeat center bottom;
}

.img-01-clone {
    background: red url("356a192b7913b04c54574d18c28d46e6395428ab.jpg"); /* the same image like for .img-01 */
}

.img-02 {
    background: red url("da4b9237bacccdf19c0760cab7aec4a8359010b0.jpg");
}

.data-uri-url {
    background-image: url("data:text;base64,LmRhdGEtdXJpLXVybA=="); /* untoched */
}

.data-external-protocols {
    background-image: url("http://xmp.com/http-img.gif"); /* untoched */
    background: url("https://xmp.com/https-img.gif"); /* untoched */
    background: url("//xmp.com/no-protocol-img.gif"); /* untoched */
}
@font-face {
    font-family: PTSans;
    src: url("c4560d9eb04db1993fb3358c1d5a1b5ae773052b.eot");
    src: url("c4560d9eb04db1993fb3358c1d5a1b5ae773052b.eot?#iefix") format('embedded-opentype'), /* replaced only filename */
        url("6b3cb27f3f4a0d4f85fe52161ec46dfbfeb31ca4.woff") format('woff'),
        url("1250e5161875c21c4b9c3915a0cb2f0d96870448.ttf") format('truetype');
    font-weight: normal;
    font-style: normal;
}
```

###### Freezing map file

```css
{
    "../img/img-01.jpg": "../../dest/356a192b7913b04c54574d18c28d46e6395428ab.jpg",
    "../img/img-01-clone.jpg": "../../dest/356a192b7913b04c54574d18c28d46e6395428ab.jpg",
    "../img/img-02.jpg": "../../dest/da4b9237bacccdf19c0760cab7aec4a8359010b0.jpg",
    "../fonts/pt-sans-regular.eot": "../../dest/c4560d9eb04db1993fb3358c1d5a1b5ae773052b.eot",
    "../fonts/pt-sans-regular.woff": "../../dest/6b3cb27f3f4a0d4f85fe52161ec46dfbfeb31ca4.woff",
    "../fonts/pt-sans-regular.ttf": "../../dest/1250e5161875c21c4b9c3915a0cb2f0d96870448.ttf",
    "style.css": "../../dest/e0286e96342c6b69b9b7ad9f1cabdcebf53caf18.css"
}
```

## Install

Install with [npm](https://www.npmjs.com/)

```sh
$ npm i gulp-css-freezer --save-dev
```

## Usage

```js
var gulpCssFreezer = require('gulp-css-freezer');

var deployPath = '../_deploy'

gulp.task('freezer-css', function () {
    return gulp.src('../static/css/*.css')
        .pipe(gulpCssFreezer({freezeMapBaseDir: '../'})) // finds all resources inside css and freeze it
        .pipe(gulp.dest(deployPath)) // writes freezed resources
        .pipe(gulpCssFreezer.freezeMapResolve()) // creates map of freezed resources
        .pipe(gulp.dest(deployPath)) // writes freeze map file
})

```

##### Options

```js
var gulpCssFreezer = require('gulp-css-freezer');

var deployPath = '../_deploy'

gulp.task('freezer-css', function () {
    return gulp.src('../static/css/*.css')
        .pipe(gulpCssFreezer({
            freezeMapBaseDir: '../static/css', // resolve paths inside map file name by freezeMapBaseDir.
                                               // default null (writes absolute path of freezed file)
            freezeNestingLevel: 3, // nesting levels of directories; default 1
            freezeMapFileName: 'freeze-map.json' // freeze map file name; default css-freeze-map.json
        }))
        .pipe(gulp.dest(deployPath))
        .pipe(gulpCssFreezer.freezeMapResolve())
        .pipe(gulp.dest(deployPath))
})

```

## Contributing
Pull requests and stars are always welcome. For bugs and feature requests, [please create an issue](https://github.com/radist2s/gulp-css-freezer/issues).

## Author

**Alex Batalov**

+ [github/radist2s](https://github.com/radist2s)

Inspired by [borschik](https://github.com/bem/borschik).

## License
Copyright © 2015 [Alex Batalov](http://tagart.ru)
Licensed under the MIT license.
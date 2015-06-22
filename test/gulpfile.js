var gulp = require('gulp')
var path = require('path')
var gulpCSSUrlRep = require('./../index')

gulp.task('test', function (cb) {
    //var gulpCSSUrlRep = require('gulp-css-freezer')

    return gulp.src(path.join(__dirname, 'fixtures/css/*.css'))
        .pipe(gulpCSSUrlRep({
            freezeMapBaseDir: './fixtures/css'
        }))
        .pipe(gulp.dest('./dest'))
})
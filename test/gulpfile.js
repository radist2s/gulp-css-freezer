var gulp = require('gulp')
var path = require('path')
var gulpCSSFreeze = require('./../index')

gulp.task('test', function () {
    return gulp.src(path.join(__dirname, 'fixtures/css/*.css'))
        .pipe(gulpCSSFreeze({
            freezeMapBaseDir: './fixtures/css',
            freezeNestingLevel: 0
        }))
        .pipe(gulp.dest('./dest'))
        .pipe(gulpCSSFreeze.freezeMapResolve())
        .pipe(gulp.dest('./dest'))
})
var gulp = require('gulp')
var path = require('path')
var gulpCSSUrlRep = require('./../index')

gulp.task('test', function () {
    return gulp.src(path.join(__dirname, 'fixtures/css/*.css'))
        .pipe(gulpCSSUrlRep({
            freezeMapBaseDir: './fixtures/css',
            freezeNestingLevel: 0
        }))
        .pipe(gulp.dest('./dest').on('end', function () {
            console.log('DEST END')
        }))
        .pipe(gulpCSSUrlRep.freezeMapResolve())
        .pipe(gulp.dest('./dest'))
})

gulp.task('list', function () {
    return gulp
        .src(path.join(__dirname, 'fixtures/css/*.css'))
        .pipe(require('gulp-filelist')('filelist.json'))
        .pipe(gulp.dest('./dest'))
})
import pkg from 'shelljs';
const { rm, exec, cp } = pkg;

rm('-rf', './dist/');
rm('-rf', './tsconfig.tsbuildinfo');
exec('yarn tsc');
rm('-rf', './tsconfig.tsbuildinfo');
cp('./package.json', './dist/package.json');
cp('./LICENSE', './dist/LICENSE');
rm('-rf', './dist/tsconfig.tsbuildinfo');
console.log('build over');
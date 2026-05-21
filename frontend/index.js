/**
 * @format
 */
import 'react-native-gesture-handler';
import './mapbox-init';
import { AppRegistry, LogBox } from 'react-native';
import App from './App';

LogBox.ignoreLogs([]);

const appName = 'ProParcel';

AppRegistry.registerComponent(appName, () => App);

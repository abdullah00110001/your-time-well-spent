import { PureShieldMainSettings } from './pureShield/PureShieldMainSettings';

export const PureViewSettings = () => (
  <PureShieldMainSettings onBack={() => window.history.back()} />
);

export default PureViewSettings;

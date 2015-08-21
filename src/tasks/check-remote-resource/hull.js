import { featurecollection, convex } from 'turf';
import through2 from 'through2';


export default class Hull {

    constructor() {
        this.aggreg = [];
    }

    through() {
        return through2.obj((feature, enc, cb) => {
            if (this.value) {
                this.value = convex(featurecollection([this.value, feature]));
            } else if (feature.geometry.type !== 'Point') {
                this.value = convex(feature);
            } else if (this.aggreg && this.aggreg.length === 2) {
                this.aggreg.push(feature);
                this.value = convex(featurecollection(this.aggreg));
                this.aggreg = null;
            } else {
                this.aggreg.push(feature);
            }

            cb(null, feature);
        });
    }

}

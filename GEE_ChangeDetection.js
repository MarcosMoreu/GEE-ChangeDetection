//A Work in progress...

                      //**CHANGE DETECTION ALGORITHM FOR NEAR-REAL DEFORESTATION MONITORING IN TROPICAL FORESTS USING SENTINEL DATA: 1st version**

//Main blocks of the algorithm:

//1st- Imports: Sentinel-1(S1) and Sentinel-2(S2) collections are imported along with eometries of training samples and region of interest (ROI)
//2nd- AOI,dates & thresholds: This is the ONLY section in which users MUST define input parameters (at least AOI and time periods). Other blocks can be used as default.
//3rd- S2 cloud & shadow free mosaic: Multiple funtions are used to appy filters to image collections and add bands containing cloud and shadow information in each pixel. Then, the function "cloudProject" apply masks to the image
//                                    collections based on the information contained in those previously calculated bands and solar geometry values. All functions are applied to every time period separately, and 4 mosaic are obtained.
//4th- S2 Classification: Training points of every LCLU class are sampled, CART classifier is trained and applied to the mosaics previously generated.
//5th- S2 Change detection: Image differencing methods (min NDVI values in 6 months (t0) are compared to NDVI values at t2) and post-classification change detection methods (classified mosaics at t1 & t2 are compared) are combined to map deforestation
//6th- S1 Preliminary Change detection (potential-deforested-areas): Maximum Absolute Deviation from the Mean (MADM) in 6 months (t0) is compared to variations between t1 and t2, both for Ascending and Descending orbit.
//7th- S1 Classification in buffers/potential-deforested-areas: Additional bands are created, training points of only two classes (Forest-No Forest) are sampled, SVM classifier is trained and applied only in potential-deforested-areas.
//8th- S1 Change detection: Post-classification change detection method (classification results within buffers at t1 and t2 are compared) is employed to map deforestation in potential-deforested-areas previously detected.
//9th- Sensor selection based on cloud cover in every pixel: A simple script is used to check the cloudiness in every pixel at t1 and t2. If a pixel is cloud free at t1 and t2, S2 is used. Otherwise, S1 is used.
//10th- Classification accuracy assessments: Classifiers (CART and SVM) performance is evaluated.
//11th- Visualizations & Exports: Final deforestation layer(s) is available for visualization in the API, or it can be exported in multiple formats (TIFF by default)

//*last modified 1st July 2018
//Author: Marcos Moreu

//#####################################             Imports            ################################################################################################

//Sentinel collections
var S2Collection = ee.ImageCollection('COPERNICUS/S2');
var S1Collection = ee.ImageCollection('COPERNICUS/S1_GRD');

//The ROI defined below was used to test the algorithm in the study that describes the 1st version of the algorithm (6-march_2018). The study is
//available under the name: "Big Earth Data for near-real time deforestation monitoring: A fustion approach with Sentinel data using Google Earth Engine"
var roi = /* color: #ffa387 */ee.Geometry.Polygon(
                                                    [[-70.21336555480957,-13.017353027487037], [-70.21353721618652,-13.080983471034672],
                                                     [-70.13740539550781,-13.080983471034672],[-70.13766288757324,-13.01743665247491],
                                                     [-70.21336555480957,-13.017353027487037]]);

// Map.addLayer(roi,{},'roi')

var training_area = /* color: #8b4a25 */ee.Geometry.Polygon(
                                                     [[-70.39249420166016, -13.052896002007353], [-70.42253494262695, -13.110582223664121],
                                                      [-70.36674499511719, -13.127969043106535], [-70.31687603669423, -13.143180026074456],
                                                      [-70.0658226013183, -13.083496461267279], [-70.14976501464838, -12.993690922990968]]);


//training points for classifying s2 imagery
var Crop_grass =  ee.FeatureCollection('ft:1UxKWxMZYGbK7z7ad8xuEwNu0eXaEM-Ze7UBIk4F2'); //class 5
var Forest = ee.FeatureCollection('ft:1f915CHqAdRCLaysMZbEG4R5ctOKE_6QRwGDcU8S9');      //class 1
var Build_up = ee.FeatureCollection('ft:1r-NRpMjB_bYwYaWMyZX97RLB9XLVXDCa0IFEVKBz');    //class 3
var Water = ee.FeatureCollection('ft:1Cq9VC1ajfYmNkZqk4Cyex7C8U-mjlD4HTCbNxz3X');       //class 4
var Bare_soil = ee.FeatureCollection('ft:16C_1m8RUVd-jgWg3ZyCQv7LbK6ZvAL-ofgXnRLdU');   //class 2
var Clouds = ee.FeatureCollection('ft:1bQFxMTvrX6gg0tAnOzGHjR-0pr6bVHrUpbEOn1Il');      //class 6

//training points for classifying s1 imagery
var Deforested = ee.FeatureCollection('ft:1Qed1g5YrDzQvdBaXIpF58wnmNFM9GsTz7O9Got9b');
var NoDeforested = ee.FeatureCollection('ft:1aReXvz24XfohG02OP4DNv0ueBtYmm2xeM6H5hs0Q');

///////////////////////////////////////////        s1 & s2 Images for  visually detect changes (accuracy assessment)      ////////////////////////////////////////////

var s2image_post = ee.Image('COPERNICUS/S2/20170823T150621_20170823T150618_T19LCF');
var s2image_pre = ee.Image('COPERNICUS/S2/20170719T145729_20170719T150054_T19LCF');
var s1image_pre = ee.Image('COPERNICUS/S1_GRD/S1B_IW_GRDH_1SDV_20170724T101407_20170724T101432_006628_00BA88_2017');
var s1image_post = ee.Image('COPERNICUS/S1_GRD/S1B_IW_GRDH_1SDV_20170829T101408_20170829T101433_007153_00C9B8_96C9');
// Map.addLayer(s2image_pre,{bands:['B4','B3','B2'],max:2000},'s2pre');
// Map.addLayer(s2image_post,{bands:['B4','B3','B2'],max:2000},'s2post');
// Map.addLayer(s1image_pre,{bands:['VH'],min: [-30], max: [0]},'s1pre')
// Map.addLayer(s1image_post,{bands:['VH'],min: [-30], max: [0]},'s1post')

//#######################################           AOI, dates & thresholds           #######################################################################################

///////////////////////////////////////////////             Define study area             /////////////////////////////////////////////////////////////////////
//Set studyArea using A, B or C below:

//A: Country
// var country_name = ['Peru'];
// var countries = ee.FeatureCollection('ft:1tdSwUL7MVpOauSgRzqVTOwdfy17KDbw-1d9omPw');
// var country = countries.filter(ee.Filter.inList('Country', country_name));
// //Map.addLayer(country,{},'Peru')

//B: Grid zone
// var grid_zone_name = ['1A'];
// var grid_zone = amazonBasinGrid.filter(ee.Filter.inList('gridZone', grid_zone_name));
// //Map.addLayer(grid_zone,{},'1A')

//C: Drawing a shape
//var roi = ....

var studyArea = roi;
Map.centerObject(studyArea,14);

///////////////////////////////////////////////              Define time periods        /////////////////////////////////////////////////////////////////////////

/////////      t0       ///////////

//Time period for creating a classified mosaic using Sentinel-2 imagery. In order to obtain a cloud free mosaic, the period should be 6 months or higher, ending when t1 starts.
var startYear_t0 = 2017;
var endYear_t0 = 2017;

var startMonth_t0 =1;
var endMonth_t0 = 7;

var startDate_t0 = ee.Date.fromYMD(startYear_t0,startMonth_t0,1);
var endDate_t0 = ee.Date.fromYMD(endYear_t0,endMonth_t0,1);

//t1 and t2 time periods must be defined keeping in mind the revisit time of the satellites. That is, the time period must be long enough so the algorithm ALWAYS finds an image
/////////       t1       ////////
//A mosaic will be created using the LATEST imagery available during the specified time period (i.e.
    //for analysing deforestation in August, the best case scenario is that the LATEST imagery available is 31 July) )
var startYear_t1 = 2017;
var endYear_t1 = 2017;

var startMonth_t1 = 7;
var endMonth_t1 = 7;

var startDate_t1 = ee.Date.fromYMD(startYear_t1,startMonth_t1,1);
var endDate_t1 = ee.Date.fromYMD(endYear_t1,endMonth_t1,20);

/////////        t2       /////////
//A mosaic will be created using the LATEST imagery available during the specified period of time (i.e.
    //for analysing deforestation in August,the best case scenario is that the LATEST imagery available is 31 August)
var startYear_t2 = 2017;
var endYear_t2 = 2017;

var startMonth_t2 = 8;
var endMonth_t2 = 8;

var startDate_t2 = ee.Date.fromYMD(startYear_t2,startMonth_t2,1);
var endDate_t2 = ee.Date.fromYMD(endYear_t2,endMonth_t2,30);

//{////ttraining paramenters.  DO NOT MODIFY!!!
//time period for training classifier in the mosaic: parameters
var studyArea_training = training_area;

var startYear_ttraining = 2017;
var endYear_ttraining = 2017;

var startMonth_ttraining =8;
var endMonth_ttraining = 12;

var startDate_ttraining = ee.Date.fromYMD(startYear_ttraining,startMonth_ttraining,1);
var endDate_ttraining = ee.Date.fromYMD(endYear_ttraining,endMonth_ttraining,1);

var cloudThresh_s2_training = 60; //DO NOT MODIFY
//}

////////////////////////////////////////////////                Define thresholds                 ////////////////////////////////////////////////////////////////////////////////////////

// cloud pixel threshold to filter imagery by percentage of cloud cover in a scene
var cloudPixelPerc_Threshold = 50; //The lower the value the lower the processing time because cloudy images in the collection will be excluded form the analysis

// cloudThreshold used to mask clouds
var cloudThresh_s2 = 50; // Very low value is selected aiming to mask all clouds, assuming that other landcovers (not forest) might also be masked

// dilatePixels: Number of pixels to buffer clouds and cloud shadows (1 or 2 generally is sufficient)
var dilatePixels_s2 = 4;

// cloudHeights: Height of clouds to use to project cloud shadows
var cloudHeights = ee.List.sequence(200,10000,500);

// zScoreThresh: Threshold for cloud shadow masking- lower number masks out less.  Between -0.8 and -1.2 generally works well
var zScoreThresh_s2 = -0.8;

// shadowSumThresh: Sum of IR bands to include as shadows within TDOM and the shadow shift method (lower number masks out less)
var shadowSumThresh_s2 = 1800;

//buffer size to create buffers around potential deforestation areas detected from s1
var buffer_size = 20;

//Correction factor for comparing mean and max variations in s1 t0 collection
var corr_Factor = 0.8;

///////       thresholds for defining max object size     ////////
//s1 change detection
var max_obj_s1_cd = 10;
//s1 classificaiton in buffers
var max_obj_s1_class = 35;
//s2 change detection
var max_obj_s2_cd = 35;
//s2 s1 combined
var max_obj_s2_s1_cd = 35;

////////      Sentinel-2 visualization parameters        /////////
var s2Viz_co = {'max': 2000, 'bands':'red,green,blue'};
var s2Viz_im= {bands:['B4','B3','B2'],max:2000};

//############################################               S2 cloud & shadow free mosaic            ###################################################################

//Script to generate a cloud free mosaic is an adaptation for S2 of the algorithm developed by SERVIR (available in GEE Tutorials), which was originally designed for Landsat data.

//Funtions to obtain a filtered image collection at t0
function getImageCollection_t0(studyArea,startDate,endDate){
  var s2; var s2_ImageCollection; var out;

  var sensorBandDictSentinel2 =ee.Dictionary({S2 : ee.List([1,2,3,7,10,11,15])});//Note that the list starts at 0!!!!!
  var bandNamesSentinel2 = ee.List(['blue','green','red','nir','swir1','swir2','QA60']);

    s2 = S2Collection
      .filterDate(startDate,endDate)
      .filter(ee.Filter.lte('CLOUDY_PIXEL_PERCENTAGE',cloudPixelPerc_Threshold))//In order to reduce the processing time, very cloudy imagery is excluded from the analysis.
      .sort('system:time_start',true)//We are interested in the latest image available during the specified time period.
      .filterBounds(studyArea)
      .select(sensorBandDictSentinel2.get('S2'),bandNamesSentinel2);
    s2_ImageCollection = ee.ImageCollection(s2);
    out = s2_ImageCollection;
  return out;
}

//Funtions to obtain a filtered image collection at t1 & t2
function getImageCollection_t1t2(studyArea,startDate,endDate){
  var s2; var s2_ImageCollection; var out;

  var sensorBandDictSentinel2 =ee.Dictionary({S2 : ee.List([1,2,3,7,10,11,15])});//Note that the list starts at 0!!!!!
  var bandNamesSentinel2 = ee.List(['blue','green','red','nir','swir1','swir2','QA60']);

    s2 = S2Collection
      .filterDate(startDate,endDate)
      .sort('system:time_start',true)//We are interested in the latest imagery available during the specified time period.
      .filterBounds(studyArea)
      .select(sensorBandDictSentinel2.get('S2'),bandNamesSentinel2);
    s2_ImageCollection = ee.ImageCollection(s2);
    out = s2_ImageCollection;
  return out;
}

//Funciton to rescale the values before defining cloud masking functions
var rescale = function(img, exp, thresholds) {
  return img.expression(exp, {img: img})
      .subtract(thresholds[0]).divide(thresholds[1] - thresholds[0]);
};

//Function for detecting clouds in the trainig mosaic
function Sentinel2CloudScore_training(img) {
  // Compute several indicators of cloudiness and take the minimum of them.
  var score = ee.Image(1000);
      // Clouds are reasonably bright in the blue band.
      score = score.min(rescale(img, 'img.blue', [1000, 3000]));

      // Clouds are reasonably bright in all visible bands.
      score = score.min(rescale(img, 'img.red + img.green + img.blue', [2000, 8000]));

      // Clouds are reasonably bright in all infrared bands.
      score = score.min(rescale(img, 'img.nir + img.swir1 + img.swir2', [3000,8000]));

  //Detect clouds using QA60 bands
  var QA60 = img.select('QA60');

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = Math.pow(2, 10);
  var cirrusBitMask = Math.pow(2, 11);

  // clear if both flags set to zero.
  var nocloud = QA60.bitwiseAnd(cloudBitMask).eq(0).and(
             QA60.bitwiseAnd(cirrusBitMask).eq(0));

  // However, clouds are not snow and cirrus...
    var ndsi = img.normalizedDifference(['green', 'swir1']);
      score =  score.min(rescale(ndsi, 'img', [8000, 6000])).multiply(100).byte();
      score = score.lt(cloudThresh_s2_training)
                            .or(QA60.neq(0)); // 1 is dense cloud, 2 is cirrus
      score = score.rename('cloudMask');
      img = img.updateMask(img.mask().and(score));

  return img.addBands(score);
}

//Function for detecting clouds in Sentinel-2 mosaic at t0,t1 and t2
function Sentinel2CloudScore(img) {
  // Compute several indicators of cloudiness and take the minimum of them.
  var score = ee.Image(1000);
      // Clouds are reasonably bright in the blue band.
      score = score.min(rescale(img, 'img.blue', [1000, 3000]));

      // Clouds are reasonably bright in all visible bands.
      score = score.min(rescale(img, 'img.red + img.green + img.blue', [2000, 8000]));

      // Clouds are reasonably bright in all infrared bands.
      score = score.min(rescale(img, 'img.nir + img.swir1 + img.swir2', [3000,8000]));

  //Detect cloud using QA60 bands
  var QA60 = img.select('QA60');

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = Math.pow(2, 10);
  var cirrusBitMask = Math.pow(2, 11);

  // clear if both flags set to zero.
  var nocloud = QA60.bitwiseAnd(cloudBitMask).eq(0).and(
             QA60.bitwiseAnd(cirrusBitMask).eq(0));

  // However, clouds are not snow and cirrus...
    var ndsi = img.normalizedDifference(['green', 'swir1']);
      score =  score.min(rescale(ndsi, 'img', [8000, 6000])).multiply(100).byte();
      score = score.lt(cloudThresh_s2)
                            .or(QA60.neq(0)); // 1 is dense cloud, 2 is cirrus
      score = score.rename('cloudMask');
      img = img.updateMask(img.mask().and(score));

  return img.addBands(score);
}
//Function for shadow masking
function simpleTDOM2(collection_s2,zScoreThresh_s2,shadowSumThresh_s2,dilatePixels_s2){
  var shadowSumBands = ['nir','swir1'];

  //Get some pixel-wise stats for the time series
  var irStdDev = collection_s2.select(shadowSumBands).reduce(ee.Reducer.stdDev());
  var irMean = collection_s2.select(shadowSumBands).mean();

  //Mask out dark outliers
  collection_s2 = collection_s2.map(function(img){
    var zScore = img.select(shadowSumBands).subtract(irMean).divide(irStdDev);
    var irSum = img.select(shadowSumBands).reduce(ee.Reducer.sum());
    var TDOMMask = zScore.lt(zScoreThresh_s2).reduce(ee.Reducer.sum()).eq(2)
        .and(irSum.lt(shadowSumThresh_s2)).not();
        TDOMMask = TDOMMask.focal_min(dilatePixels_s2);
    return img.addBands(TDOMMask.rename('TDOMMask'));
  });

  return collection_s2;
}

//Function for generating cloud and shadow free mosaic, using outputs from all preivious functions
function cloudProject(img,shadowSumThresh_s2,dilatePixels_s2,cloudHeights){

  //Get the cloud mask
  var cloud = img.select('cloudMask').not();
      cloud = cloud.focal_max(dilatePixels_s2);
      cloud = cloud.updateMask(cloud);

  //Get TDOM mask
  var TDOMMask = img.select(['TDOMMask']).not();

  //Project the shadow finding pixels inside the TDOM mask that are dark and
  //inside the expected area given the solar geometry
  //Find dark pixels
  var darkPixels = img.select(['nir','swir1','swir2'])
                      .reduce(ee.Reducer.sum()).lt(shadowSumThresh_s2);

  //Get scale of image
  var nominalScale = cloud.projection().nominalScale();

  //Find where cloud shadows should be based on solar geometry
  //Convert to radians
  var meanAzimuth = img.get('MEAN_SOLAR_AZIMUTH_ANGLE');
  var meanZenith = img.get('MEAN_SOLAR_ZENITH_ANGLE');
  var azR = ee.Number(meanAzimuth).multiply(Math.PI).divide(180.0)
                                  .add(ee.Number(0.5).multiply(Math.PI ));
  var zenR = ee.Number(0.5).multiply(Math.PI )
                           .subtract(ee.Number(meanZenith).multiply(Math.PI).divide(180.0));

  //Find the shadows
  var shadows = cloudHeights.map(function(cloudHeight){
    cloudHeight = ee.Number(cloudHeight);
    var shadowCastedDistance = zenR.tan()
        .multiply(cloudHeight);//Distance shadow is cast
    var x = azR.cos().multiply(shadowCastedDistance)
        .divide(nominalScale).round();//X distance of shadow
    var y = azR.sin().multiply(shadowCastedDistance)
        .divide(nominalScale).round();//Y distance of shadow
    return cloud.changeProj(cloud.projection(), cloud.projection()
        .translate(x, y));
  });

  var shadow = ee.ImageCollection.fromImages(shadows).max();

  //Create shadow mask
      shadow = shadow.updateMask(shadow.mask().and(cloud.mask().not()));
      shadow = shadow.focal_max(dilatePixels_s2);
      shadow = shadow.updateMask(shadow.mask().and(darkPixels).and(TDOMMask));

  //Combine the cloud and shadow masks
  var combinedMask = cloud.mask().or(shadow.mask()).eq(0);

  //Update the image's mask and return the image
  img = img.updateMask(img.mask().and(combinedMask));
  img = img.addBands(combinedMask.rename(['cloudShadowMask']));
  return img;
}

//Function for calculating NDVI
function NDVI(img){
  var ndvi = img.normalizedDifference(['nir','red']);
  return img.addBands(ndvi.rename('ndvi'));
}

///////////////////////////////////////////////////////             Call functions above...              ///////////////////////////////////////////////////////
//{//////////       ttraining      ////////////
var s2_ttraining = getImageCollection_t0(studyArea_training, startDate_ttraining, endDate_ttraining);
    s2_ttraining = s2_ttraining.map(Sentinel2CloudScore_training);
    s2_ttraining = simpleTDOM2(s2_ttraining,zScoreThresh_s2,shadowSumThresh_s2,dilatePixels_s2);
    s2_ttraining = s2_ttraining.map(function(img){return cloudProject(img,shadowSumThresh_s2,dilatePixels_s2, cloudHeights)});
    s2_ttraining = s2_ttraining.map(NDVI);
var median_ttraining = s2_ttraining.median();
var FINAL_MOSAIC_s2_ttraining = median_ttraining;
//Map.addLayer(FINAL_MOSAIC_s2_ttraining, s2Viz_co, 's2_cloudfreemosaic_ttraining', true);//}

/////////////     t0        //////////////////
var s2_t0 = getImageCollection_t0(studyArea, startDate_t0, endDate_t0);
    s2_t0 = s2_t0.map(Sentinel2CloudScore);
    s2_t0 = simpleTDOM2(s2_t0,zScoreThresh_s2,shadowSumThresh_s2,dilatePixels_s2);
    s2_t0 = s2_t0.map(function(img){return cloudProject(img,shadowSumThresh_s2,dilatePixels_s2, cloudHeights)});
    s2_t0 = s2_t0.map(NDVI);
var median_t0 = s2_t0.median();
var FINAL_MOSAIC_s2_t0 = median_t0;
//Map.addLayer(FINAL_MOSAIC_s2_t0, s2Viz_co, 'FINAL_MOSAIC_s2_t0');

/////////////       t1     //////////////////////
var s2_t1 = getImageCollection_t1t2(studyArea, startDate_t1, endDate_t1);
    s2_t1 = s2_t1.map(Sentinel2CloudScore);
    s2_t1 = simpleTDOM2(s2_t1,zScoreThresh_s2,shadowSumThresh_s2,dilatePixels_s2);
    s2_t1 = s2_t1.map(function(img){return cloudProject(img,shadowSumThresh_s2,dilatePixels_s2, cloudHeights)});
    s2_t1 = s2_t1.map(NDVI);
var median_t1 = s2_t1.median();
var FINAL_MOSAIC_s2_t1 = median_t1;
//Map.addLayer(FINAL_MOSAIC_s2_t1, s2Viz_co, 'FINAL_MOSAIC_s2_t1');

/////////////       t2      //////////////////////
var s2_t2 = getImageCollection_t1t2(studyArea, startDate_t2, endDate_t2);
    s2_t2 = s2_t2.map(Sentinel2CloudScore);
    s2_t2 = simpleTDOM2(s2_t2,zScoreThresh_s2,shadowSumThresh_s2,dilatePixels_s2);
    s2_t2 = s2_t2.map(function(img){return cloudProject(img,shadowSumThresh_s2,dilatePixels_s2, cloudHeights)});
    s2_t2 = s2_t2.map(NDVI);
var median_t2 = s2_t2.median();
var FINAL_MOSAIC_s2_t2 = median_t2;
//Map.addLayer(FINAL_MOSAIC_s2_t2, s2Viz_co, 'FINAL_MOSAIC_s2_t2');

//##############################################################           S2    Classification                 ###########################################################################

//add image for training classifiers
var bands_s2 =  ['blue','green','red','nir','swir1','swir2','ndvi'];
var training_image_s2 = FINAL_MOSAIC_s2_ttraining.select(bands_s2);

//merge all feature collections
var training_merged_s2 = Forest.merge(Bare_soil).merge(Build_up).merge(Water).merge(Crop_grass).merge(Clouds);

//sample training points
var training_s2 = training_image_s2.sampleRegions({
  // Get the sample from the polygons FeatureCollection.
  collection: training_merged_s2 ,
  // Keep this list of properties from the polygons.
  properties: ['class'],
  // Set the scale to get Landsat pixels in the polygons.
  scale: 10,
});

//train the classifier
var classifier_s2 = ee.Classifier.cart().train({
  features: training_s2,
  classProperty: 'class',
  inputProperties: bands_s2
});

//////////////////////////////////////                Apply classifyiers           ////////////////////////////////

////////////////////       s2  t2      ////////////////////////
var classified_s2_t2 = FINAL_MOSAIC_s2_t2.select(bands_s2).classify(classifier_s2);
//Map.addLayer(classified_s2_t2,{min: 1, max: 6, palette: ['#13931d', '#ba661e', '#bca893','#2f10d6','#14eb1b','#f739f1']}, 'classification_s2_t2');

////////////////////       s2  t1      ////////////////////////
var classified_s2_t1 = FINAL_MOSAIC_s2_t1.select(bands_s2).classify(classifier_s2);
//Map.addLayer(classified_s2_t1,{min: 1, max: 6, palette: ['#13931d', '#ba661e', '#bca893','#2f10d6','#14eb1b','#f739f1']}, 'classification_s2_t1');

////////////////////       s2  t0      ////////////////////////
var classified_s2_t0 = FINAL_MOSAIC_s2_t0.select(bands_s2).classify(classifier_s2);
//Map.addLayer(classified_s2_t0,{min: 1, max: 6, palette: ['#13931d', '#ba661e', '#bca893','#2f10d6','#14eb1b','#f739f1']}, 'classification_s2_t0');

//###########################################################       S2 Change detection    ##################################################################################################

//Non forest pixels at t0 are masked aiming to reduce the processing time for calculating the  MIN reducer
var ForestPixels = classified_s2_t0.eq(1);

function maskNonForest_s2(s2){
  var masked_s2 = s2.updateMask(ForestPixels);//Forested pixels are 1, thus other landcovers are masked.
 return masked_s2;
}

var s2_t0_masked = s2_t0.map(maskNonForest_s2);
FINAL_MOSAIC_s2_t2 = maskNonForest_s2(FINAL_MOSAIC_s2_t2);

//select NDVI band
var S2_t0_collection_ndvi = s2_t0_masked.select('ndvi');

// //Reducers: Calculate min NDVI values of the collection during the specified period of time
var S2_t0_coll_min = S2_t0_collection_ndvi.min();

var FINAL_MOSAIC_s2_t2_ndvi = FINAL_MOSAIC_s2_t2.select('ndvi');

//Compare min NDVI at t0 with NDVI at t2
var s2_change_ndvi = FINAL_MOSAIC_s2_t2_ndvi.subtract(S2_t0_coll_min);
    s2_change_ndvi = s2_change_ndvi.lt(0);//if negative means that the ndvi at t2 is lower than the min ndvi value in all the images contained in t0 collection

//Deforested areas must match the below conditions:
var s2_change = s2_change_ndvi.eq(1).and(classified_s2_t2.neq(1)).and(classified_s2_t2.neq(6)).and(classified_s2_t1.eq(1));

// Minimize impact of false positives by filtering changes by size. That is, changes smaller than Xha are removed
    s2_change = s2_change.updateMask(s2_change);
//Instead of selecting only objects greater than X, we select objects smaller than X. We do it this way in order to reduce the processing time
var s2_change_object = s2_change.connectedPixelCount(max_obj_s2_cd,false);
    s2_change_object = s2_change_object.lt(max_obj_s2_cd);
//Now we select only the pixels which value is 0 because they are the large objects
    s2_change_object = s2_change_object.eq(0);
    s2_change_object = s2_change_object.unmask();

//Minimize impact of false negatives by removing false negatives surrounded by pixels classified as deforested. We use connectedPixelCount, but
var false_negatives_s2 = s2_change_object.eq(0);                                                                     //reduceNeighborhood method [reducer:sum(); kernel:square(3)] is also an option.
    false_negatives_s2 = false_negatives_s2.updateMask(false_negatives_s2);
var false_negative_s2_obj = false_negatives_s2.connectedPixelCount(11, false);// We asume that an area of 1000sqmeters classified as NoDeforested surrounded by
    false_negative_s2_obj = false_negative_s2_obj.lt(11);                        // deforested pixels can be considered as false negative
    false_negative_s2_obj = false_negative_s2_obj.eq(1);
    false_negative_s2_obj = false_negative_s2_obj.unmask();

var DEFORESTED_s2 = s2_change_object.eq(1).or(false_negative_s2_obj.eq(1));
//DEFORESTED_s2 contains the deforested areas detected using Sentinel-2 imagery.

//{//###########################################################       S1 Preliminary Change detection (potential-deforested-areas)    ################################################################

//Apply filters to image collections (Ascending and Descending orbit)
var S1filter_A = S1Collection.filterBounds(studyArea).filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                                                     .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                                                     .filterMetadata('instrumentMode', 'equals', 'IW')
                                                     .filter(ee.Filter.eq('resolution_meters', 10))
                                                     .filter(ee.Filter.eq('orbitProperties_pass', 'ASCENDING'));

var S1filter_D = S1Collection.filterBounds(studyArea).filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VV'))
                                                     .filter(ee.Filter.listContains('transmitterReceiverPolarisation', 'VH'))
                                                     .filterMetadata('instrumentMode', 'equals', 'IW')
                                                     .filter(ee.Filter.eq('resolution_meters', 10))
                                                     .filter(ee.Filter.eq('orbitProperties_pass', 'DESCENDING'));

// ASCENDING
var s1_t1_A = S1filter_A.filterDate(startDate_t1,endDate_t1).sort('system:time_start',true).mosaic();// "true" gets the latest imagery available during the specified period
var s1_t2_A = S1filter_A.filterDate(startDate_t2,endDate_t2).sort('system:time_start',true).mosaic();
var S1_A_t0_collection = S1filter_A.filterDate(startDate_t0,endDate_t0);

//DESCENDING
var s1_t1_D = S1filter_D.filterDate(startDate_t1,endDate_t1).sort('system:time_start',true).mosaic();
var s1_t2_D = S1filter_D.filterDate(startDate_t2,endDate_t2).sort('system:time_start',true).mosaic();
var S1_D_t0_collection = S1filter_D.filterDate(startDate_t0,endDate_t0);

// //////////////////////////////////              Non Forest and darklines mask and sumVVVH functions                 //////////////////////

function maskNonForest_s1(s1collection){
  var masked_s1collection = s1collection.updateMask(ForestPixels);
 return masked_s1collection;
}

var S1_A_t0_collection_masked = S1_A_t0_collection.map(maskNonForest_s1);
var S1_D_t0_collection_masked = S1_D_t0_collection.map(maskNonForest_s1);

//Select water and dark pixels (space between two scenes in a mosaic)
function darkPixels(S1){
    var darkPx = S1.select('sumVVVH').lt(60);
  return S1.updateMask(darkPx);
}

//function to sum the bands VV and VH
function sumVVVH(s1collection){
    var sum = s1collection.select('VV').abs().add(s1collection.select('VH').abs());
  return s1collection.addBands(sum.rename('sumVVVH'));
}

//////////////            call functions sumVVVH and darkPixels          /////////////////

//////  t0  ///
//call function to add sumVVVH to the collection
var S1_A_t0_collectionVVVH =  S1_A_t0_collection_masked.map(sumVVVH);
    S1_A_t0_collectionVVVH = S1_A_t0_collectionVVVH.select('sumVVVH');
// call function to mask darkPixels
   S1_A_t0_collectionVVVH = S1_A_t0_collectionVVVH.map(darkPixels);

var S1_D_t0_collectionVVVH =  S1_D_t0_collection_masked.map(sumVVVH);
    S1_D_t0_collectionVVVH = S1_D_t0_collectionVVVH.select('sumVVVH');
// call function to mask darkPixels
    S1_D_t0_collectionVVVH = S1_D_t0_collectionVVVH.map(darkPixels);

var S1_A_t0_coll_max_VVVH = S1_A_t0_collectionVVVH.max(); ///////////////max because the sign has changed!!!!!!!!!!!!!!!!!
var S1_D_t0_coll_max_VVVH = S1_D_t0_collectionVVVH.max();
var S1_A_t0_coll_mean_VVVH = S1_A_t0_collectionVVVH.mean();
var S1_D_t0_coll_mean_VVVH = S1_D_t0_collectionVVVH.mean();

var diff_S1_A_t0 = S1_A_t0_coll_max_VVVH.subtract(S1_A_t0_coll_mean_VVVH);
    diff_S1_A_t0 = diff_S1_A_t0.multiply(corr_Factor);// apply a factor to detect more (eg 0.9) or less (eg.1.1) changes
var diff_S1_D_t0 = S1_D_t0_coll_max_VVVH.subtract(S1_D_t0_coll_mean_VVVH);
    diff_S1_D_t0 = diff_S1_D_t0.multiply(corr_Factor);//''

////   t1 & t2   /////
//ASCENDING
var s1_t1_A_VVVH = sumVVVH(s1_t1_A);
    s1_t1_A_VVVH = s1_t1_A_VVVH.select('sumVVVH');
    s1_t1_A_VVVH = darkPixels(s1_t1_A_VVVH);

var s1_t2_A_VVVH = sumVVVH(s1_t2_A);
    s1_t2_A_VVVH = s1_t2_A_VVVH.select('sumVVVH');
    s1_t2_A_VVVH = darkPixels(s1_t2_A_VVVH);

//DESCENDING
var s1_t1_D_VVVH = sumVVVH(s1_t1_D);
    s1_t1_D_VVVH = s1_t1_D_VVVH.select('sumVVVH');
    s1_t1_D_VVVH = darkPixels(s1_t1_D_VVVH);

var s1_t2_D_VVVH = sumVVVH(s1_t2_D);
    s1_t2_D_VVVH = s1_t2_D_VVVH.select('sumVVVH');
    s1_t2_D_VVVH = darkPixels(s1_t2_D_VVVH);

//Calculate the diff between t1 and t2
//ASCENDING
var diff_s1_A_t2t1 = s1_t2_A_VVVH.subtract(s1_t1_A_VVVH);

//DESCENDING
var diff_s1_D_t2t1 = s1_t2_D_VVVH.subtract(s1_t1_D_VVVH);

//Compare difference max-mean (i.e. changes ocurred during t_0) with difference t2-t1

//ASCENDING
var s1_A_change = diff_S1_A_t0.subtract(diff_s1_A_t2t1);
var s1_A_change_binary = s1_A_change.lt(0);//if less than zero means that the change between t1 and t2 is higher than the highest difference in the collection

//DESCENDING
var s1_D_change = diff_S1_D_t0.subtract(diff_s1_D_t2t1);
var s1_D_change_binary = s1_D_change.lt(0);

// Combine outputs ASCENDING & DESCENDING
var s1_change_A_D = s1_A_change_binary.eq(1).and(s1_D_change_binary.eq(1));

// filter by size. That is, changes smaller than X pixels are removed
    s1_change_A_D = s1_change_A_D.updateMask(s1_change_A_D);

//Instead of selecting only objects greater than X, we select objects smaller than X. We do it this way in order to reduce the processing time
var s1_change_A_D_object = s1_change_A_D.connectedPixelCount(max_obj_s1_cd, false);
var s1_change_A_D_object_lt_th = s1_change_A_D_object.lt(max_obj_s1_cd);

//Now we select only the values with 0 because they are the large objects
var s1_change_A_D_object_gt_th = s1_change_A_D_object_lt_th.eq(0);
var s1_change_A_D_object_gt_th_unmasked = s1_change_A_D_object_gt_th.unmask();

//Create buffers around the detected changes
var s1_CD_dilated = s1_change_A_D_object_gt_th_unmasked.focal_max(buffer_size);

//#######################################################            S1 Classification in buffers/potential-deforested-areas          #############################################################

//Get a permanent s1 image to train the classifiers
var s1_training_image_post = ee.Image('COPERNICUS/S1_GRD/S1B_IW_GRDH_1SDV_20170829T101408_20170829T101433_007153_00C9B8_96C9');
var bands_s1_class = ['VV','VH','sumVVVH','sumVVVHdiv2'];

//Below the functions to add new bands to s1 datasets
function sumVVVH(s1collection){
   var sum = s1collection.select('VV').abs().add(s1collection.select('VH').abs());
 return s1collection.addBands(sum.rename('sumVVVH'));
}

function sumVVVHdiv2(s1collection){
   var VVVHdiv2 = s1collection.select('VV').abs().add(s1collection.select('VH').abs());
       VVVHdiv2 = VVVHdiv2.divide(2);
 return s1collection.addBands(VVVHdiv2.rename('sumVVVHdiv2'));
}

function VVminusVH(s1collection){
   var diff = s1collection.select('VV').abs().subtract(s1collection.select('VH').abs());
 return s1collection.addBands(diff.rename('VVminusVH'));
}

var s1_training_image_post_VVVH = sumVVVH(s1_training_image_post);
    s1_training_image_post_VVVH = sumVVVHdiv2(s1_training_image_post_VVVH);
//Map.addLayer(s1_training_image_post_VVVH,{bands:['VV','VH','sumVVVH'], min:-30,max:30}, 's1_training_post');

  s1_t1_D_VVVH = sumVVVH(s1_t1_D);
  s1_t1_D_VVVH = sumVVVHdiv2(s1_t1_D_VVVH);
  s1_t1_D_VVVH = VVminusVH(s1_t1_D_VVVH);

  s1_t2_D_VVVH = sumVVVH(s1_t2_D);
  s1_t2_D_VVVH = sumVVVHdiv2(s1_t2_D_VVVH);


//Merge training datasets.
var s1_training_points_post = Deforested.merge(NoDeforested);

//sample training points
var training_s1_buffers = s1_training_image_post_VVVH.sampleRegions({
  // Get the sample from the polygons FeatureCollection.
  collection: s1_training_points_post ,
  // Keep this list of properties from the polygons.
  properties: ['class'],
  // Set the scale to get Sentinel-2 pixels in the polygons.
  scale: 10
});

//train the classifier
var classifier_s1_buffers = ee.Classifier.svm({ kernelType: 'RBF',  gamma: 8,  cost: 100}).train({
  features: training_s1_buffers,
  classProperty: 'class',
  inputProperties: bands_s1_class
});

//mask outside buffers
var s1_t2_D_buffers = s1_t2_D_VVVH.updateMask(s1_CD_dilated);
var s1_t1_D_buffers = s1_t1_D_VVVH.updateMask(s1_CD_dilated);

//classify s1 images
var classified_s1_t2_buffers = s1_t2_D_buffers.select(bands_s1_class)
                                                      .classify(classifier_s1_buffers);
var classified_s1_t1_buffers = s1_t1_D_buffers.select(bands_s1_class)
                                                      .classify(classifier_s1_buffers);

//###########################################################################            S1 Change detection           #####################################################################################

//intersect t1 and t2
var s1_class_intersected_t1t2 = classified_s1_t2_buffers.eq(1).and(classified_s1_t1_buffers.eq(0));

// Minimize impact of false positives by filtering changes by size. That is, changes smaller than Xha are removed
var s1_class_intersected_t1t2 = s1_class_intersected_t1t2.updateMask(s1_class_intersected_t1t2);
var s1_class_intersected_t1t2_obj = s1_class_intersected_t1t2.connectedPixelCount(max_obj_s1_class, false);
    s1_class_intersected_t1t2_obj = s1_class_intersected_t1t2_obj.lt(max_obj_s1_class);
    s1_class_intersected_t1t2_obj = s1_class_intersected_t1t2_obj.eq(0);
    s1_class_intersected_t1t2_obj = s1_class_intersected_t1t2_obj.unmask();

//Minimize impact of false negatives by removing false negatives surrounded by pixels classified as deforested. We use connectedPixelCount, but reduceNeighborhood method [reducer:sum(); kernel:square(3)] is also an option.
var false_negatives_s1 = s1_class_intersected_t1t2_obj.eq(0);
    false_negatives_s1 = false_negatives_s1.updateMask(false_negatives_s1);
var false_negative_s1_obj = false_negatives_s1.connectedPixelCount(11, false);// We asume that an area of 1000sqmeters classified as NoDeforested surrounded by
    false_negative_s1_obj = false_negative_s1_obj.lt(11);                          //deforested pixels can be considered as false negative
    false_negative_s1_obj = false_negative_s1_obj.eq(1);
    false_negative_s1_obj = false_negative_s1_obj.unmask();

var DEFORESTED_s1 = s1_class_intersected_t1t2_obj.eq(1).or(false_negative_s1_obj.eq(1));
//DEFORESTED_s1 contains the deforested areas detected using Sentinel-1 imagery. Sentinel-2 imagery has only been used to mask non-forested areas at t_0

//###################################################             Sensor selection based on cloud cover in every pixel            ###########################################################################

//If a pixel is cloud free, only Sentinel-2 data is used for mapping changes. Else, Sentinel-1 is used.
var notMasked_s2_t1t2 = classified_s2_t2.gte(1).and(classified_s2_t2.lte(5)).and(classified_s2_t1.gte(1)).and(classified_s2_t1.lte(5));//This expresion excludes "clouds" landcover, i.e. selects every landcover (1 to 5), both at t2 and t1
var cd_s2_s1_combined = DEFORESTED_s2.where(notMasked_s2_t1t2.eq(0),DEFORESTED_s1);
    cd_s2_s1_combined = cd_s2_s1_combined.updateMask(cd_s2_s1_combined);

//Again, object based methods are used to remove small clusters of pixels
var cd_s2_s1_combined_object = cd_s2_s1_combined.connectedPixelCount(max_obj_s2_s1_cd,false);
var cd_s2_s1_combined_object_lt_th = cd_s2_s1_combined_object.lt(max_obj_s2_s1_cd);
var cd_s2_s1_combined_object_gt_th = cd_s2_s1_combined_object_lt_th.eq(0);

//Unmask
var DEFORESTED = cd_s2_s1_combined_object_gt_th.unmask();
//****DEFORESTED is the final change detection layer that shows deforested areas detected from  S2 or S1 imagery, depending on cloud cover.****

//#####################################################              Classifications Accuracy assessments                       ###############################################################################

////////////////////////////////////               s2  classifier (CART) accuraccy assessment           //////////////////////////////////

//Partition of training points and testing points. Ratio 70/30
var trainingTesting_s2 = training_s2.randomColumn();
var trainingSet_s2 = trainingTesting_s2.filter(ee.Filter.lessThan('random', 0.7));
var testingSet_s2 = trainingTesting_s2.filter(ee.Filter.greaterThanOrEquals('random', 0.7));

//Train the classifier with the trainingSet:
var trained_s2 = ee.Classifier.cart().train({
  features: trainingSet_s2,
  classProperty: 'class',
  inputProperties: bands_s2
});

// Classify the testingSet and get a confusion matrix.
var confusionMatrix_s2 = ee.ConfusionMatrix(testingSet_s2.classify(trained_s2)
    .errorMatrix({
      actual: 'class',
      predicted: 'classification'
    }));

// print('Confusion matrix s2:', confusionMatrix_s2);
// print('Overall Accuracy s2:', confusionMatrix_s2.accuracy());
// print('kappa Accuracy s2:', confusionMatrix_s2.kappa());
// print('Producers Accuracy s2:', confusionMatrix_s2.producersAccuracy());
// print('Consumers Accuracy s2:', confusionMatrix_s2.consumersAccuracy());

///////////////////////////////////                s1  classifier accuracy assessment          /////////////////////////////////

//Partition of training points and testing points. Ratio 70/30
var trainingTesting_s1 = training_s1_buffers.randomColumn();
var trainingSet_s1 = trainingTesting_s1.filter(ee.Filter.lessThan('random', 0.7));
var testingSet_s1 = trainingTesting_s1.filter(ee.Filter.greaterThanOrEquals('random', 0.7));

//Train the classifier with the trainingSet:
var trained_s1 = ee.Classifier.svm({ kernelType: 'RBF',  gamma: 8,  cost: 100}).train({
  features: trainingSet_s1,
  classProperty: 'class',
  inputProperties: bands_s1_class
});

// Classify the testingSet and get a confusion matrix.
var confusionMatrix_s1 = ee.ConfusionMatrix(testingSet_s1.classify(trained_s1)
    .errorMatrix({
      actual: 'class',
      predicted: 'classification'
    }));

// print('Confusion matrix s1:', confusionMatrix_s1);
// print('Overall Accuracy s1:', confusionMatrix_s1.accuracy());
// print('kappa Accuracy s1:', confusionMatrix_s1.kappa());
// print('Producers Accuracy s1:', confusionMatrix_s1.producersAccuracy());
// print('Consumers Accuracy s1:', confusionMatrix_s1.consumersAccuracy());

//######################################################                   Visualize & Export layers               ###############################################################

//Map.addLayer(DEFORESTED_s1,{min:0,max:1,palette: ['fafff9', 'b02700']},'DEFORESTED_s1');
//Map.addLayer(DEFORESTED_s2,{min:0,max:1,palette: ['fafff9', 'b02700']},'DEFORESTED_s2');
//Map.addLayer(DEFORESTED,{min:0,max:1,palette: ['fafff9', 'b02700']},'DEFORESTED');

//Note that in a cloud free image, DEFORESTED_S2 equals DEFORESTED

///////////////////////////////////          export as TIFF file         //////////////

// //Export results
Export.image.toDrive({
  image: DEFORESTED.clip(studyArea),
  description: 'DEFORESTED',
  scale: 10,
  region: studyArea,
  maxPixels:1000000000000
});

Export.image.toDrive({
  image: DEFORESTED_s1.clip(studyArea),
  description: 'DEFORESTED_s1',
  scale: 10,
  region: studyArea,
  maxPixels:1000000000000
});

Export.image.toDrive({
  image: DEFORESTED_s2.clip(studyArea),
  description: 'DEFORESTED_s2',
  scale: 10,
  region: studyArea,
  maxPixels:1000000000000
});


//////////////////////////////////           export as vector file        //////////////////########################
//var DEFORESTED_s1_binary = DEFORESTED_s1.neq(0);

//raster to vectors.
// var DEFORESTED_masked = DEFORESTED_s1_binary.updateMask(DEFORESTED);

// var DEFORESTED_masked_vector = DEFORESTED_masked.reduceToVectors({
//   geometry: peruBoundaries,
//   crs: DEFORESTED_masked.projection(),
//   scale: 10,
//   geometryType: 'polygon',
//   eightConnected:  false,
//   maxPixels: 1000000000000   ///
//   //labelProperty: 'zone',
//   //reducer: ee.Reducer.mean()
// });

// // Export vector to a KML file.
// Export.table.toDrive({
//   collection: DEFORESTED_masked_vector,
//   description:'...',
//   fileFormat: 'GeoJSON'
// });

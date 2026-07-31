import jstat from 'jstat';
import {
  cameraFootprintWidth,
  covariance,
  trimmedMean,
  vincentyDistance,
} from './math.js';
import type {
  AnnotationRecord,
  CameraRecord,
  ComputationOutput,
  ImageRecord,
  JollyResultRecord,
  StratumRecord,
  TransectRecord,
  ValidationCounts,
} from './types.js';

interface ValidImage {
  id: string;
  transectId: string;
  cameraId: string;
  latitude: number;
  longitude: number;
  altitude_agl: number;
  timestamp: number;
}

interface TransectMetrics {
  stratumId: string;
  transectId: string;
  distance: number;
  widthAverage: number;
  areaSquareKilometres: number;
  animalCounts: Record<string, number>;
}

interface SurveyAccumulatorOptions {
  surveyId: string;
  annotationSetId: string;
  organizationId: string;
  categoryIds: string[];
  cameras: CameraRecord[];
  strata: StratumRecord[];
  transects: TransectRecord[];
  now?: () => string;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export class SurveyAccumulator {
  private readonly surveyId: string;
  private readonly annotationSetId: string;
  private readonly organizationId: string;
  private readonly categoryIds: string[];
  private readonly selectedCategories: Set<string>;
  private readonly cameraMap: Map<string, CameraRecord>;
  private readonly stratumMap: Map<string, StratumRecord>;
  private readonly transectMap: Map<string, TransectRecord>;
  private readonly now: () => string;
  private readonly imagesByTransect = new Map<string, ValidImage[]>();
  private readonly imageToTransect = new Map<string, string>();
  private readonly countsByTransect = new Map<
    string,
    Record<string, number>
  >();
  private readonly validation: ValidationCounts = {
    excludedImages: 0,
    missingTransect: 0,
    missingCamera: 0,
    missingPosition: 0,
    missingAltitude: 0,
    missingTimestamp: 0,
    invalidCameraOptics: 0,
    annotationsForExcludedImages: 0,
  };

  constructor(options: SurveyAccumulatorOptions) {
    this.surveyId = options.surveyId;
    this.annotationSetId = options.annotationSetId;
    this.organizationId = options.organizationId;
    this.categoryIds = [...new Set(options.categoryIds)];
    this.selectedCategories = new Set(this.categoryIds);
    this.cameraMap = new Map(
      options.cameras.map((camera) => [camera.id, camera])
    );
    this.stratumMap = new Map(
      options.strata.map((stratum) => [stratum.id, stratum])
    );
    this.transectMap = new Map(
      options.transects.map((transect) => [transect.id, transect])
    );
    this.now = options.now ?? (() => new Date().toISOString());

    if (this.categoryIds.length === 0) {
      throw new Error('At least one category is required');
    }
    if (this.cameraMap.size === 0) {
      throw new Error('No cameras found for survey');
    }
    if (this.stratumMap.size === 0) {
      throw new Error('No strata found for survey');
    }
    if (this.transectMap.size === 0) {
      throw new Error('No transects found for survey');
    }
  }

  get validImageCount(): number {
    return this.imageToTransect.size;
  }

  addImage(image: ImageRecord): void {
    const exclude = (reason: keyof ValidationCounts): void => {
      this.validation.excludedImages += 1;
      this.validation[reason] += 1;
    };

    if (!image.transectId || !this.transectMap.has(image.transectId)) {
      exclude('missingTransect');
      return;
    }
    if (!image.cameraId || !this.cameraMap.has(image.cameraId)) {
      exclude('missingCamera');
      return;
    }
    if (
      !isFiniteNumber(image.latitude) ||
      !isFiniteNumber(image.longitude)
    ) {
      exclude('missingPosition');
      return;
    }
    if (!isFiniteNumber(image.altitude_agl) || image.altitude_agl < 0) {
      exclude('missingAltitude');
      return;
    }
    if (!isFiniteNumber(image.timestamp)) {
      exclude('missingTimestamp');
      return;
    }

    const camera = this.cameraMap.get(image.cameraId)!;
    if (
      !isFiniteNumber(camera.sensorWidthMm) ||
      camera.sensorWidthMm <= 0 ||
      !isFiniteNumber(camera.focalLengthMm) ||
      camera.focalLengthMm <= 0 ||
      !isFiniteNumber(camera.tiltDegrees)
    ) {
      exclude('invalidCameraOptics');
      return;
    }

    const validImage: ValidImage = {
      id: image.id,
      transectId: image.transectId,
      cameraId: image.cameraId,
      latitude: image.latitude,
      longitude: image.longitude,
      altitude_agl: image.altitude_agl,
      timestamp: image.timestamp,
    };
    const images = this.imagesByTransect.get(image.transectId) ?? [];
    images.push(validImage);
    this.imagesByTransect.set(image.transectId, images);
    this.imageToTransect.set(image.id, image.transectId);
  }

  addAnnotation(annotation: AnnotationRecord): void {
    if (
      annotation.id !== annotation.objectId ||
      !this.selectedCategories.has(annotation.categoryId)
    ) {
      return;
    }
    const transectId = this.imageToTransect.get(annotation.imageId);
    if (!transectId) {
      this.validation.annotationsForExcludedImages += 1;
      return;
    }
    const counts = this.countsByTransect.get(transectId) ?? {};
    counts[annotation.categoryId] =
      (counts[annotation.categoryId] ?? 0) + 1;
    this.countsByTransect.set(transectId, counts);
  }

  calculate(): ComputationOutput {
    if (this.imageToTransect.size === 0) {
      throw new Error('No usable images found for survey');
    }

    const warnings: string[] = [];
    if (this.validation.excludedImages > 0) {
      warnings.push(
        `${this.validation.excludedImages} images were excluded because required survey data was missing or invalid`
      );
    }
    if (this.validation.annotationsForExcludedImages > 0) {
      warnings.push(
        `${this.validation.annotationsForExcludedImages} selected annotations belonged to excluded images`
      );
    }

    const metricsByStratum = new Map<string, TransectMetrics[]>();
    for (const [transectId, images] of this.imagesByTransect.entries()) {
      const metrics = this.calculateTransect(transectId, images);
      if (!metrics) {
        warnings.push(
          `Transect ${transectId} was excluded because it had insufficient usable track data`
        );
        continue;
      }
      const current = metricsByStratum.get(metrics.stratumId) ?? [];
      current.push(metrics);
      metricsByStratum.set(metrics.stratumId, current);
    }

    const uncomputable = [...this.stratumMap.values()].filter(
      (stratum) => !metricsByStratum.get(stratum.id)?.length
    );
    if (uncomputable.length > 0) {
      throw new Error(
        `The following strata have no computable transects: ${uncomputable
          .map((stratum) => stratum.name ?? stratum.id)
          .join(', ')}`
      );
    }

    const timestamp = this.now();
    const results: JollyResultRecord[] = [];
    for (const [stratumId, metrics] of metricsByStratum.entries()) {
      const stratum = this.stratumMap.get(stratumId)!;
      if (
        !isFiniteNumber(stratum.area) ||
        stratum.area <= 0 ||
        !isFiniteNumber(stratum.baselineLength) ||
        stratum.baselineLength <= 0
      ) {
        throw new Error(
          `Stratum ${stratum.name ?? stratum.id} is missing a positive area or baseline length`
        );
      }

      const sampleCount = metrics.length;
      const areaSurveyed = metrics.reduce(
        (sum, metric) => sum + metric.areaSquareKilometres,
        0
      );
      const sampledAreas = metrics.map(
        (metric) => metric.areaSquareKilometres
      );
      const averageWidth =
        metrics.reduce(
          (sum, metric) => sum + metric.widthAverage,
          0
        ) / sampleCount;
      const populationTransects = stratum.baselineLength / averageWidth;

      for (const categoryId of this.categoryIds) {
        const animalCounts = metrics.map(
          (metric) => metric.animalCounts[categoryId] ?? 0
        );
        const animals = animalCounts.reduce(
          (sum, count) => sum + count,
          0
        );
        const density = animals / areaSurveyed;
        const covarianceAnimals = covariance(
          animalCounts,
          animalCounts
        );
        const covarianceAnimalArea = covariance(
          animalCounts,
          sampledAreas
        );
        const covarianceAreas = covariance(
          sampledAreas,
          sampledAreas
        );
        const rawVariance =
          sampleCount < 2
            ? 0
            : ((populationTransects *
                (populationTransects - sampleCount)) /
                sampleCount) *
              (covarianceAnimals -
                2 * density * covarianceAnimalArea +
                density * density * covarianceAreas);
        const variance = Math.max(0, rawVariance);
        const standardError = Math.sqrt(variance);
        const estimate = density * stratum.area;
        const criticalValue =
          sampleCount > 1
            ? jstat.studentt.inv(0.975, sampleCount - 1)
            : 0;
        const lowerBound95 =
          estimate - criticalValue * standardError;
        const upperBound95 =
          estimate + criticalValue * standardError;

        const result: JollyResultRecord = {
          surveyId: this.surveyId,
          stratumId,
          annotationSetId: this.annotationSetId,
          categoryId,
          animals,
          areaSurveyed,
          estimate,
          density,
          variance,
          standardError,
          numSamples: sampleCount,
          lowerBound95,
          upperBound95,
          group: this.organizationId,
          createdAt: timestamp,
          updatedAt: timestamp,
          __typename: 'JollyResult',
          'stratumId#annotationSetId#categoryId':
            `${stratumId}#${this.annotationSetId}#${categoryId}`,
        };
        this.assertFiniteResult(result);
        results.push(result);
      }
    }

    return {
      results,
      validation: { ...this.validation },
      warnings,
    };
  }

  private calculateTransect(
    transectId: string,
    images: ValidImage[]
  ): TransectMetrics | null {
    const transect = this.transectMap.get(transectId);
    if (!transect || !this.stratumMap.has(transect.stratumId)) {
      return null;
    }

    const byTimestamp = new Map<number, ValidImage[]>();
    for (const image of images) {
      const cohort = byTimestamp.get(image.timestamp) ?? [];
      cohort.push(image);
      byTimestamp.set(image.timestamp, cohort);
    }
    const cohorts = [...byTimestamp.entries()]
      .sort(([first], [second]) => first - second)
      .map(([timestamp, cohortImages]) => {
        const latitude =
          cohortImages.reduce(
            (sum, image) => sum + image.latitude,
            0
          ) / cohortImages.length;
        const longitude =
          cohortImages.reduce(
            (sum, image) => sum + image.longitude,
            0
          ) / cohortImages.length;
        // Cameras firing at the same instant are independent strips: the swath
        // is the sum of their widths, overlap intentionally not deducted.
        const width = cohortImages.reduce((sum, image) => {
          const camera = this.cameraMap.get(image.cameraId)!;
          return (
            sum +
            cameraFootprintWidth(
              image.altitude_agl,
              camera.sensorWidthMm!,
              camera.focalLengthMm!,
              camera.tiltDegrees!
            )
          );
        }, 0);
        return {
          timestamp,
          latitude,
          longitude,
          width,
        };
      });

    if (cohorts.length < 2) return null;
    const deltas = cohorts
      .slice(1)
      .map(
        (cohort, index) =>
          cohort.timestamp - cohorts[index]!.timestamp
      )
      .filter((delta) => delta > 0);
    const meanDelta = trimmedMean(deltas);
    const sections: Array<typeof cohorts> = [[]];
    for (let index = 0; index < cohorts.length; index += 1) {
      if (
        index > 0 &&
        meanDelta > 0 &&
        cohorts[index]!.timestamp -
          cohorts[index - 1]!.timestamp >
          3 * meanDelta
      ) {
        sections.push([]);
      }
      sections[sections.length - 1]!.push(cohorts[index]!);
    }

    const distance = sections.reduce((total, section) => {
      if (section.length < 2) return total;
      const start = section[0]!;
      const end = section[section.length - 1]!;
      return (
        total +
        vincentyDistance(
          start.latitude,
          start.longitude,
          end.latitude,
          end.longitude
        )
      );
    }, 0);
    const widthAverage =
      cohorts.reduce((sum, cohort) => sum + cohort.width, 0) /
      cohorts.length;
    const areaSquareKilometres =
      (distance * widthAverage) / 1_000_000;
    if (
      !Number.isFinite(areaSquareKilometres) ||
      areaSquareKilometres <= 0
    ) {
      return null;
    }

    const existingCounts = this.countsByTransect.get(transectId) ?? {};
    const animalCounts = Object.fromEntries(
      this.categoryIds.map((categoryId) => [
        categoryId,
        existingCounts[categoryId] ?? 0,
      ])
    );
    return {
      stratumId: transect.stratumId,
      transectId,
      distance,
      widthAverage,
      areaSquareKilometres,
      animalCounts,
    };
  }

  private assertFiniteResult(result: JollyResultRecord): void {
    const numericFields: Array<keyof JollyResultRecord> = [
      'animals',
      'areaSurveyed',
      'estimate',
      'density',
      'variance',
      'standardError',
      'numSamples',
      'lowerBound95',
      'upperBound95',
    ];
    for (const field of numericFields) {
      if (!Number.isFinite(result[field] as number)) {
        throw new Error(
          `Calculation produced an invalid ${field} for stratum ${result.stratumId} and category ${result.categoryId}`
        );
      }
    }
  }
}
